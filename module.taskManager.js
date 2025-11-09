/*
Task Manager - Version CORRIGÉE avec répartition intelligente
Résout le problème des workers inactifs et optimise l'utilisation des sources
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
    
    /**
     * Point d'entrée principal
     */
    run: function(creep) {
        // Affichage de la tâche (si configuré)
        if (CONFIG.TASK_CONFIG.displayTasksWithSay && 
            Game.time % CONFIG.TASK_CONFIG.sayFrequency === 0) {
            let emoji = this.getTaskEmoji(creep.memory.currentTask);
            creep.say(emoji);
        }
        
        // 🔧 FIX CRITIQUE : Gestion correcte des états
        if (creep.store[RESOURCE_ENERGY] === 0 && creep.memory.currentTask !== TASKS.HARVEST) {
            // Vide → passer en mode récolte
            creep.memory.currentTask = TASKS.HARVEST;
            creep.memory.taskTarget = null;
        }
        else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 && creep.memory.currentTask === TASKS.HARVEST) {
            // Plein → chercher une nouvelle tâche
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
     * Assigne la meilleure tâche selon les priorités DYNAMIQUES
     */
    assignBestTask: function(creep) {
        let room = creep.room;
        
        // Si vide → récolter
        if (creep.store[RESOURCE_ENERGY] === 0) {
            return this.assignHarvestTask(creep);
        }
        
        // Calculer les priorités selon l'état de la room
        let priorities = this.calculateDynamicPriorities(room);
        
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
     * 🎯 NOUVELLE VERSION : Priorités VRAIMENT dynamiques
     */
    calculateDynamicPriorities: function(room) {
        let priorities = [];
        
        // 🔍 Analyse de l'état de la room
        let energyPercent = room.energyAvailable / room.energyCapacityAvailable;
        let stats = RepairManager.getRepairStats(room);
        let controllerNearDecay = this.isControllerNearDecay(room);
        
        // 1️⃣ CRITIQUE : Spawn/Extensions vides (< seuil critique)
        if (energyPercent < CONFIG.TASK_CONFIG.criticalEnergyThreshold) {
            priorities.push(TASKS.TRANSFER);
        }
        
        // 2️⃣ URGENT : Controller proche du decay (risque de downgrade)
        if (controllerNearDecay) {
            priorities.push(TASKS.UPGRADE);
        }
        
        // 3️⃣ URGENT : Structures critiques à réparer
        if (stats.critical > 0) {
            priorities.push(TASKS.REPAIR);
        }
        
        // 4️⃣ IMPORTANT : Containers sources en construction
        let missingContainers = ConstructionManager.countMissingSourceContainers(room);
        if (missingContainers > 0) {
            priorities.push(TASKS.BUILD);
        }
        
        // 5️⃣ NORMAL : Remplir spawn/extensions si < seuil transfer
        if (energyPercent < CONFIG.TASK_CONFIG.transferPriorityThreshold) {
            if (!priorities.includes(TASKS.TRANSFER)) {
                priorities.push(TASKS.TRANSFER);
            }
        }
        
        // 6️⃣ Constructions normales
        if (ConstructionManager.needsConstruction(room)) {
            if (!priorities.includes(TASKS.BUILD)) {
                priorities.push(TASKS.BUILD);
            }
        }
        
        // 7️⃣ Réparations normales
        if (stats.damaged > 0) {
            if (!priorities.includes(TASKS.REPAIR)) {
                priorities.push(TASKS.REPAIR);
            }
        }
        
        // 8️⃣ Upgrade (seulement si pas critique ou si controller OK)
        if (!priorities.includes(TASKS.UPGRADE)) {
            priorities.push(TASKS.UPGRADE);
        }
        
        // 🔧 Garantir un minimum d'upgraders (si configuré)
        priorities = this.enforceMinimumUpgraders(room, priorities);
        
        return priorities;
    },
    
    /**
     * 🆕 Vérifie si le controller est proche du decay
     */
    isControllerNearDecay: function(room) {
        if (!CONFIG.TASK_CONFIG.upgradeOnlyWhenNearDecay) {
            return false; // Feature désactivée
        }
        
        let controller = room.controller;
        if (!controller || !controller.my) return false;
        
        // RCL 1 n'a pas de downgrade
        if (controller.level === 1) return false;
        
        let threshold = CONFIG.TASK_CONFIG.upgradeDecayThreshold || 5000;
        return controller.ticksToDowngrade < threshold;
    },
    
    /**
     * 🎯 NOUVEAU : Force au moins N creeps à upgrader en permanence
     */
    enforceMinimumUpgraders: function(room, priorities) {
        // 🔧 Support des fonctions ET des valeurs fixes
        let minUpgraders = CONFIG.TASK_CONFIG.minUpgradersAlways;
        
        // Si c'est une fonction, l'appeler avec la room
        if (typeof minUpgraders === 'function') {
            minUpgraders = minUpgraders(room);
        }
        
        // Si 0 ou undefined, ne rien forcer
        if (!minUpgraders || minUpgraders === 0) {
            return priorities;
        }
        
        let upgraders = _.filter(Game.creeps, c => 
            c.room.name === room.name && 
            c.memory.currentTask === TASKS.UPGRADE &&
            c.store[RESOURCE_ENERGY] > 0
        ).length;
        
        if (upgraders < minUpgraders) {
            // Forcer upgrade en priorité
            priorities = [TASKS.UPGRADE, ...priorities.filter(t => t !== TASKS.UPGRADE)];
        }
        
        return priorities;
    },
    
    /**
     * 🔧 FIX : Assigne une tâche de récolte INTELLIGENTE
     * Répartit les workers entre les sources
     */
    assignHarvestTask: function(creep) {
        creep.memory.currentTask = TASKS.HARVEST;
        
        // 🎯 NOUVEAU : Choisir la meilleure source
        let bestSource = this.findBestHarvestSource(creep);
        if (bestSource) {
            creep.memory.harvestSourceId = bestSource.id;
        }
        
        return true;
    },
    
    /**
     * 🎯 NOUVEAU : Trouve la meilleure source pour un worker
     * Critères : 
     * - Containers avec énergie disponible
     * - Répartition équilibrée des workers
     */
    findBestHarvestSource: function(creep) {
        let room = creep.room;
        let sources = room.find(FIND_SOURCES);
        
        let candidates = [];
        
        for (let source of sources) {
            // Trouver le container de cette source
            let container = source.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0];
            
            if (!container || container.store[RESOURCE_ENERGY] < 50) {
                continue; // Pas de container ou vide
            }
            
            // Compter combien de workers vont déjà vers cette source
            let workersOnSource = _.filter(Game.creeps, c => 
                c.memory.harvestSourceId === source.id &&
                c.memory.currentTask === TASKS.HARVEST
            ).length;
            
            candidates.push({
                source: source,
                container: container,
                energy: container.store[RESOURCE_ENERGY],
                workers: workersOnSource,
                distance: creep.pos.getRangeTo(container)
            });
        }
        
        if (candidates.length === 0) {
            return null; // Aucune source disponible
        }
        
        // Trier par : moins de workers > plus d'énergie > plus proche
        candidates.sort((a, b) => {
            if (a.workers !== b.workers) return a.workers - b.workers;
            if (Math.abs(a.energy - b.energy) > 100) return b.energy - a.energy;
            return a.distance - b.distance;
        });
        
        return candidates[0].container;
    },
    
    /**
     * Assigne une tâche de construction
     */
    assignBuildTask: function(creep) {
        let target = ConstructionManager.findPriorityConstructionSite(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.BUILD;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * Assigne une tâche de réparation
     */
    assignRepairTask: function(creep) {
        let target = RepairManager.findRepairTarget(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.REPAIR;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * Assigne une tâche d'upgrade
     */
    assignUpgradeTask: function(creep) {
        creep.memory.currentTask = TASKS.UPGRADE;
        creep.memory.taskTarget = creep.room.controller.id;
        return true;
    },
    
    /**
     * 🔧 FIX : Assigne une tâche de transfer INTELLIGENTE
     */
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
        
        // Priorité 3 : Storage (dernier recours)
        if (!target && creep.room.storage) {
            target = creep.room.storage;
        }
        
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.TRANSFER;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * Exécute la tâche actuelle
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
     * 🔧 FIX : Exécution de la récolte
     */
    doHarvest: function(creep) {
        // Essayer de récupérer depuis le container assigné
        if (creep.memory.harvestSourceId) {
            let container = Game.getObjectById(creep.memory.harvestSourceId);
            if (container && container.store[RESOURCE_ENERGY] > 0) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {reusePath: 20});
                }
                return;
            }
        }
        
        // Fallback : utiliser la méthode standard
        let useSource = CONFIG.shouldUseSourcesDirectly(creep, creep.room);
        creep.getEnergy(true, useSource);
    },
    
    /**
     * Exécution : Construction
     */
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
    
    /**
     * Exécution : Réparation
     */
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
    
    /**
     * Exécution : Upgrade
     */
    doUpgrade: function(creep) {
        let controller = creep.room.controller;
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {reusePath: 20});
        }
    },
    
    /**
     * Exécution : Transfer
     */
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
    
    /**
     * Vérifie si une tâche est terminée
     */
    isTaskComplete: function(creep) {
        let task = creep.memory.currentTask;
        
        // Harvest terminé si plein
        if (task === TASKS.HARVEST) {
            return creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
        }
        
        // Autres tâches terminées si vide
        if (creep.store[RESOURCE_ENERGY] === 0) {
            return true;
        }
        
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target) return true;
        
        // Build terminé si construction finie
        if (task === TASKS.BUILD && target.progress >= target.progressTotal) {
            return true;
        }
        
        // Repair terminé si HP max
        if (task === TASKS.REPAIR && target.hits >= target.hitsMax) {
            return true;
        }
        
        // Transfer terminé si target pleine
        if (task === TASKS.TRANSFER && !CONFIG.hasSpaceForEnergy(target)) {
            return true;
        }
        
        return false;
    },
    
    /**
     * Emoji pour affichage visuel
     */
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
     * Statistiques pour le rapport
     */
    getTaskStats: function(room) {
        let stats = {
            harvest: 0,
            build: 0,
            repair: 0,
            upgrade: 0,
            transfer: 0,
            idle: 0
        };
        
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            if (creep.room.name !== room.name) continue;
            if (['miner', 'lorry', 'longDistanceHarvester'].includes(creep.memory.role)) continue;
            
            let task = creep.memory.currentTask;
            if (task && stats[task] !== undefined) {
                stats[task]++;
            } else {
                stats.idle++;
            }
        }
        
        return stats;
    }
};