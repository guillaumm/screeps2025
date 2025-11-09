/*
Task Manager v2 - Avec politiques stratégiques et contrôle strict des sources
🎯 Empêche le harvest direct sur sources avec miners
📊 Applique les politiques pour optimiser la répartition
*/

const CONFIG = require('config.orchestrator');
const RepairManager = require('module.repairManager');
const ConstructionManager = require('module.constructionManager');

const TASKS = {
    HARVEST: 'harvest',
    BUILD: 'build',
    REPAIR: 'repair',
    UPGRADE: 'upgrade',
    TRANSFER: 'transfer'
};

module.exports = {
    
    run: function(creep) {
        // Affichage de la tâche
        if (CONFIG.TASK_CONFIG.displayTasksWithSay && 
            Game.time % CONFIG.TASK_CONFIG.sayFrequency === 0) {
            let emoji = this.getTaskEmoji(creep.memory.currentTask);
            creep.say(emoji);
        }
        
        // Gestion des états
        if (creep.store[RESOURCE_ENERGY] === 0 && creep.memory.currentTask !== TASKS.HARVEST) {
            creep.memory.currentTask = TASKS.HARVEST;
            creep.memory.taskTarget = null;
        }
        else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 && creep.memory.currentTask === TASKS.HARVEST) {
            creep.memory.currentTask = null;
            creep.memory.taskTarget = null;
        }
        
        // Si pas de tâche ou tâche terminée, en trouver une
        if (!creep.memory.currentTask || this.isTaskComplete(creep)) {
            this.assignBestTask(creep);
        }
        
        // Exécuter la tâche
        this.executeTask(creep);
    },
    
    /**
     * 🎯 NOUVEAU : Assigne la meilleure tâche avec politiques
     */
    assignBestTask: function(creep) {
        let room = creep.room;
        
        // Si vide → récolter
        if (creep.store[RESOURCE_ENERGY] === 0) {
            return this.assignHarvestTask(creep);
        }
        
        // Récupérer la politique active
        let policy = CONFIG.getActivePolicy();
        
        // Calculer les priorités selon l'état de la room ET la politique
        let priorities = this.calculatePrioritiesWithPolicy(room, policy);
        
        // Essayer chaque tâche par ordre de priorité
        for (let taskType of priorities) {
            let assigned = false;
            
            switch(taskType) {
                case TASKS.TRANSFER:
                    assigned = this.assignTransferTask(creep);
                    break;
                case TASKS.BUILD:
                    assigned = this.assignBuildTask(creep);
                    break;
                case TASKS.REPAIR:
                    assigned = this.assignRepairTask(creep);
                    break;
                case TASKS.UPGRADE:
                    assigned = this.assignUpgradeTask(creep);
                    break;
            }
            
            if (assigned) return;
        }
        
        // Fallback : upgrade
        this.assignUpgradeTask(creep);
    },
    
    /**
     * 🎯 NOUVEAU : Calcul des priorités avec politique stratégique
     */
    calculatePrioritiesWithPolicy: function(room, policy) {
        let priorities = [];
        
        // Analyse de l'état
        let energyPercent = room.energyAvailable / room.energyCapacityAvailable;
        let stats = RepairManager.getRepairStats(room);
        let controllerNearDecay = this.isControllerNearDecay(room);
        let missingContainers = ConstructionManager.countMissingSourceContainers(room);
        
        // 🔴 PRIORITÉS ABSOLUES (ignorent la politique)
        
        // 1. Spawn/Extensions VIDES (critique)
        if (energyPercent < CONFIG.TASK_CONFIG.criticalEnergyThreshold) {
            priorities.push(TASKS.TRANSFER);
        }
        
        // 2. Controller proche decay (urgent)
        if (controllerNearDecay) {
            priorities.push(TASKS.UPGRADE);
        }
        
        // 3. Structures critiques
        if (stats.critical > 0) {
            priorities.push(TASKS.REPAIR);
        }
        
        // 4. Containers sources (vital)
        if (missingContainers > 0) {
            priorities.push(TASKS.BUILD);
        }
        
        // 🟡 PRIORITÉS NORMALES (influencées par politique)
        
        let taskScores = {
            [TASKS.TRANSFER]: 0,
            [TASKS.BUILD]: 0,
            [TASKS.REPAIR]: 0,
            [TASKS.UPGRADE]: 0
        };
        
        // Calculer les scores de base
        if (energyPercent < CONFIG.TASK_CONFIG.transferPriorityThreshold) {
            taskScores[TASKS.TRANSFER] = 10;
        }
        
        if (ConstructionManager.needsConstruction(room)) {
            taskScores[TASKS.BUILD] = 8;
        }
        
        if (stats.damaged > 0) {
            taskScores[TASKS.REPAIR] = 6;
        }
        
        taskScores[TASKS.UPGRADE] = 5;  // Score de base toujours présent
        
        // 📊 APPLIQUER LES MODIFICATEURS DE POLITIQUE
        taskScores[TASKS.TRANSFER] *= (policy.priorityModifiers.transfer || 1.0);
        taskScores[TASKS.BUILD] *= (policy.priorityModifiers.build || 1.0);
        taskScores[TASKS.REPAIR] *= (policy.priorityModifiers.repair || 1.0);
        taskScores[TASKS.UPGRADE] *= (policy.priorityModifiers.upgrade || 1.0);
        
        // Trier les tâches par score (plus haut = plus prioritaire)
        let sortedTasks = Object.entries(taskScores)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
        
        // Ajouter les tâches non déjà présentes
        for (let task of sortedTasks) {
            if (!priorities.includes(task)) {
                priorities.push(task);
            }
        }
        
        // 🎯 FORCER UN RATIO MINIMUM D'UPGRADERS (selon politique)
        priorities = this.enforceMinimumUpgraders(room, priorities, policy);
        
        return priorities;
    },
    
    /**
     * 🎯 MODIFIÉ : Force un ratio d'upgraders selon la politique
     */
    enforceMinimumUpgraders: function(room, priorities, policy) {
        let totalWorkers = _.filter(Game.creeps, c => 
            c.room.name === room.name && 
            !['miner', 'lorry', 'longDistanceHarvester'].includes(c.memory.role) &&
            c.store[RESOURCE_ENERGY] > 0
        ).length;
        
        if (totalWorkers === 0) return priorities;
        
        let currentUpgraders = _.filter(Game.creeps, c => 
            c.room.name === room.name && 
            c.memory.currentTask === TASKS.UPGRADE &&
            c.store[RESOURCE_ENERGY] > 0
        ).length;
        
        let requiredUpgraders = Math.ceil(totalWorkers * policy.minUpgradersRatio);
        
        if (currentUpgraders < requiredUpgraders) {
            // Forcer upgrade en priorité
            priorities = [TASKS.UPGRADE, ...priorities.filter(t => t !== TASKS.UPGRADE)];
        }
        
        return priorities;
    },
    
    /**
     * 🔧 MODIFIÉ : Récolte STRICTE (containers seulement si miner présent)
     */
    assignHarvestTask: function(creep) {
        creep.memory.currentTask = TASKS.HARVEST;
        
        // Toujours essayer les containers en priorité
        let bestContainer = this.findBestHarvestContainer(creep);
        if (bestContainer) {
            creep.memory.harvestSourceId = bestContainer.id;
            creep.memory.harvestMode = 'container';
            return true;
        }
        
        // 🔧 NOUVEAU : Vérifier si harvest direct autorisé
        if (CONFIG.TASK_CONFIG.strictSourceControl) {
            // Chercher des sources NON réservées par miners
            let availableSources = CONFIG.getAvailableSourcesForHarvest(creep.room);
            
            if (availableSources.length > 0) {
                let closestSource = creep.pos.findClosestByPath(availableSources);
                if (closestSource) {
                    creep.memory.harvestSourceId = closestSource.id;
                    creep.memory.harvestMode = 'source';
                    return true;
                }
            }
            
            // Aucune source disponible, attendre au spawn
            creep.memory.harvestMode = 'waiting';
            return true;
        }
        
        // Fallback : ancien comportement
        let useSource = CONFIG.shouldUseSourcesDirectly(creep, creep.room);
        if (useSource) {
            let source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                creep.memory.harvestSourceId = source.id;
                creep.memory.harvestMode = 'source';
            }
        }
        
        return true;
    },
    
    /**
     * 🎯 NOUVEAU : Trouve le meilleur container pour harvest
     */
    findBestHarvestContainer: function(creep) {
        let room = creep.room;
        
        // Chercher tous les containers avec énergie
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] >= 50
        });
        
        if (containers.length === 0) {
            return null;
        }
        
        // Compter les workers par container
        let candidates = containers.map(container => {
            let workersOnContainer = _.filter(Game.creeps, c => 
                c.memory.harvestSourceId === container.id &&
                c.memory.currentTask === TASKS.HARVEST
            ).length;
            
            return {
                container: container,
                workers: workersOnContainer,
                energy: container.store[RESOURCE_ENERGY],
                distance: creep.pos.getRangeTo(container)
            };
        });
        
        // Trier : moins de workers > plus d'énergie > plus proche
        candidates.sort((a, b) => {
            if (a.workers !== b.workers) return a.workers - b.workers;
            if (Math.abs(a.energy - b.energy) > 100) return b.energy - a.energy;
            return a.distance - b.distance;
        });
        
        return candidates[0].container;
    },
    
    assignBuildTask: function(creep) {
        let target = ConstructionManager.findPriorityConstructionSite(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.BUILD;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    assignRepairTask: function(creep) {
        let target = RepairManager.findRepairTarget(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.REPAIR;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    assignUpgradeTask: function(creep) {
        creep.memory.currentTask = TASKS.UPGRADE;
        creep.memory.taskTarget = creep.room.controller.id;
        return true;
    },
    
    assignTransferTask: function(creep) {
        // Priorité 1 : Spawn et Extensions
        let target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: s => (
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION
            ) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // Priorité 2 : Towers (si < 50% énergie)
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER &&
                           s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.5
            });
        }
        
        // Priorité 3 : Storage
        if (!target && creep.room.storage) {
            target = creep.room.storage;
        }
        
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.TRANSFER;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * 🔧 MODIFIÉ : Exécution avec mode harvest
     */
    executeTask: function(creep) {
        switch(creep.memory.currentTask) {
            case TASKS.HARVEST:
                this.doHarvest(creep);
                break;
            case TASKS.BUILD:
                this.doBuild(creep);
                break;
            case TASKS.REPAIR:
                this.doRepair(creep);
                break;
            case TASKS.UPGRADE:
                this.doUpgrade(creep);
                break;
            case TASKS.TRANSFER:
                this.doTransfer(creep);
                break;
            default:
                this.assignBestTask(creep);
        }
    },
    
    /**
     * 🔧 MODIFIÉ : Récolte selon le mode
     */
    doHarvest: function(creep) {
        let mode = creep.memory.harvestMode;
        
        if (mode === 'waiting') {
            // Attendre près du spawn
            let spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                creep.moveTo(spawn);
            }
            // Réévaluer régulièrement
            if (Game.time % 5 === 0) {
                creep.memory.currentTask = null;
            }
            return;
        }
        
        let target = Game.getObjectById(creep.memory.harvestSourceId);
        if (!target) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (mode === 'container') {
            // Récolter depuis container
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {reusePath: 20});
            }
        } else {
            // Harvest direct (seulement si autorisé)
            if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {reusePath: 20});
            }
        }
    },
    
    doBuild: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 15});
        }
    },
    
    doRepair: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target || target.hits >= target.hitsMax) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 15});
        }
    },
    
    doUpgrade: function(creep) {
        let controller = creep.room.controller;
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {reusePath: 20});
        }
    },
    
    doTransfer: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target || !CONFIG.hasSpaceForEnergy(target)) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 15});
        }
    },
    
    isControllerNearDecay: function(room) {
        if (!CONFIG.TASK_CONFIG.upgradeOnlyWhenNearDecay) {
            return false;
        }
        
        let controller = room.controller;
        if (!controller || !controller.my || controller.level === 1) {
            return false;
        }
        
        let threshold = CONFIG.TASK_CONFIG.upgradeDecayThreshold || 5000;
        return controller.ticksToDowngrade < threshold;
    },
    
    isTaskComplete: function(creep) {
        let task = creep.memory.currentTask;
        
        if (task === TASKS.HARVEST) {
            return creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
        }
        
        if (creep.store[RESOURCE_ENERGY] === 0) {
            return true;
        }
        
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target) return true;
        
        if (task === TASKS.BUILD && target.progress >= target.progressTotal) {
            return true;
        }
        
        if (task === TASKS.REPAIR && target.hits >= target.hitsMax) {
            return true;
        }
        
        if (task === TASKS.TRANSFER && !CONFIG.hasSpaceForEnergy(target)) {
            return true;
        }
        
        return false;
    },
    
    getTaskEmoji: function(task) {
        const EMOJIS = {
            [TASKS.HARVEST]: '⛏️',
            [TASKS.BUILD]: '🔨',
            [TASKS.REPAIR]: '🔧',
            [TASKS.UPGRADE]: '⚡',
            [TASKS.TRANSFER]: '📦'
        };
        return EMOJIS[task] || '❓';
    },
    
    /**
     * 📊 NOUVEAU : Statistiques enrichies avec politique
     */
    getTaskStats: function(room) {
        let stats = {
            harvest: 0,
            build: 0,
            repair: 0,
            upgrade: 0,
            transfer: 0,
            idle: 0,
            total: 0
        };
        
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            if (creep.room.name !== room.name) continue;
            if (['miner', 'lorry', 'longDistanceHarvester'].includes(creep.memory.role)) continue;
            
            stats.total++;
            let task = creep.memory.currentTask;
            if (task && stats[task] !== undefined) {
                stats[task]++;
            } else {
                stats.idle++;
            }
        }
        
        // Ajouter la politique active
        stats.activePolicy = CONFIG.getActivePolicy().name;
        
        return stats;
    }
};