/*
Task Manager v3 - Optimisation géographique + Workers polyvalents avancés
🎯 Workers peuvent faire du lorry si besoin
📍 Optimisation des trajets avec relais énergétiques
⚡ Démarrage anticipé des tâches selon énergie disponible
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
        
        // 🎯 NOUVEAU : Gestion fluide de l'énergie (pas d'états binaires)
        let energyPercent = creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
        
        // Si presque vide → forcer harvest
        if (energyPercent < 0.1 && creep.memory.currentTask !== TASKS.HARVEST) {
            creep.memory.currentTask = TASKS.HARVEST;
            creep.memory.taskTarget = null;
        }
        // Si assez d'énergie et en harvest → chercher une tâche productive
        else if (energyPercent >= 0.3 && creep.memory.currentTask === TASKS.HARVEST) {
            creep.memory.currentTask = null;
            creep.memory.taskTarget = null;
        }
        
        // Si pas de tâche ou tâche terminée, en trouver une
        if (!creep.memory.currentTask || this.isTaskComplete(creep)) {
            this.assignBestTask(creep);
        }
        
        // 📍 NOUVEAU : Optimisation du chemin avant exécution
        this.optimizeTaskExecution(creep);
        
        // Exécuter la tâche
        this.executeTask(creep);
    },
    
    /**
     * 🎯 NOUVEAU : Assigne la meilleure tâche avec logique avancée
     */
    assignBestTask: function(creep) {
        let room = creep.room;
        let energyPercent = creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
        
        // Si presque vide → harvest
        if (energyPercent < 0.1) {
            return this.assignHarvestTask(creep);
        }
        
        // 📊 Analyser la situation de la room
        let situation = this.analyzeRoomSituation(room);
        
        // 🎯 NOUVEAU : Même avec peu d'énergie, essayer les tâches proches
        if (energyPercent >= 0.3 && energyPercent < 0.7) {
            // Chercher des tâches proches pour éviter de perdre l'énergie
            let nearbyTask = this.findNearbyTask(creep, situation);
            if (nearbyTask) {
                return true;
            }
        }
        
        // Récupérer la politique active
        let policy = CONFIG.getActivePolicy();
        
        // Calculer les priorités avec contexte géographique
        let priorities = this.calculateSmartPriorities(room, situation, policy, creep);
        
        // Essayer chaque tâche par ordre de priorité
        for (let taskType of priorities) {
            let assigned = false;
            
            switch(taskType) {
                case TASKS.TRANSFER:
                    assigned = this.assignTransferTask(creep, situation);
                    break;
                case TASKS.BUILD:
                    assigned = this.assignBuildTask(creep, situation);
                    break;
                case TASKS.REPAIR:
                    assigned = this.assignRepairTask(creep, situation);
                    break;
                case TASKS.UPGRADE:
                    assigned = this.assignUpgradeTask(creep, situation);
                    break;
            }
            
            if (assigned) return;
        }
        
        // Fallback : upgrade (toujours possible)
        this.assignUpgradeTask(creep, situation);
    },
    
    /**
     * 📊 NOUVEAU : Analyse complète de la situation de la room
     */
    analyzeRoomSituation: function(room) {
        let situation = {
            // Énergie
            energyPercent: room.energyAvailable / room.energyCapacityAvailable,
            storageEnergy: room.storage ? room.storage.store[RESOURCE_ENERGY] : 0,
            
            // Besoins
            repairStats: RepairManager.getRepairStats(room),
            missingContainers: ConstructionManager.countMissingSourceContainers(room),
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            
            // Controller
            controllerNearDecay: this.isControllerNearDecay(room),
            
            // Structures énergétiques (relais)
            energyRelays: this.findEnergyRelays(room),
            
            // Statistiques workers
            workerStats: this.getWorkerDistribution(room),
            
            // 🎯 NOUVEAU : Besoin de lorries
            needsTransfer: false,
            transferUrgency: 0
        };
        
        // Calculer le besoin de transfer
        let emptyStructures = room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || 
                         s.structureType === STRUCTURE_EXTENSION) &&
                         CONFIG.hasSpaceForEnergy(s)
        }).length;
        
        situation.needsTransfer = emptyStructures > 0;
        situation.transferUrgency = emptyStructures / Math.max(1, room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION
        }).length);
        
        return situation;
    },
    
    /**
     * 📍 NOUVEAU : Trouve les relais énergétiques disponibles
     */
    findEnergyRelays: function(room) {
        let relays = [];
        
        // Storage
        if (room.storage && room.storage.store[RESOURCE_ENERGY] > 500) {
            relays.push({
                structure: room.storage,
                type: 'storage',
                energy: room.storage.store[RESOURCE_ENERGY],
                priority: 3
            });
        }
        
        // Containers pleins
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] > 200
        });
        
        for (let container of containers) {
            relays.push({
                structure: container,
                type: 'container',
                energy: container.store[RESOURCE_ENERGY],
                priority: 1  // Priorité haute (source d'énergie primaire)
            });
        }
        
        // Extensions/Spawns pleins (peuvent servir de relais)
        let fullStructures = room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_EXTENSION || 
                         s.structureType === STRUCTURE_SPAWN) &&
                        s.store[RESOURCE_ENERGY] === s.store.getCapacity(RESOURCE_ENERGY)
        });
        
        for (let struct of fullStructures) {
            relays.push({
                structure: struct,
                type: 'extension',
                energy: struct.store[RESOURCE_ENERGY],
                priority: 2  // Priorité moyenne (relais secondaire)
            });
        }
        
        return relays;
    },
    
    /**
     * 📍 NOUVEAU : Trouve une tâche proche pour optimiser les trajets
     */
    findNearbyTask: function(creep, situation) {
        let pos = creep.pos;
        let nearbyRange = 10;  // Range de recherche
        
        // 1. Transfer proche (si urgent)
        if (situation.transferUrgency > 0.5) {
            let nearbyTransfer = pos.findInRange(FIND_MY_STRUCTURES, nearbyRange, {
                filter: s => (s.structureType === STRUCTURE_SPAWN || 
                             s.structureType === STRUCTURE_EXTENSION) &&
                            CONFIG.hasSpaceForEnergy(s)
            });
            
            if (nearbyTransfer.length > 0) {
                creep.memory.currentTask = TASKS.TRANSFER;
                creep.memory.taskTarget = nearbyTransfer[0].id;
                return true;
            }
        }
        
        // 2. Construction proche
        let nearbySite = pos.findInRange(FIND_CONSTRUCTION_SITES, nearbyRange);
        if (nearbySite.length > 0) {
            // Prioriser les containers sources
            let prioritySite = ConstructionManager.findPriorityConstructionSite(creep.room, creep);
            if (prioritySite && pos.getRangeTo(prioritySite) <= nearbyRange) {
                creep.memory.currentTask = TASKS.BUILD;
                creep.memory.taskTarget = prioritySite.id;
                return true;
            }
            
            creep.memory.currentTask = TASKS.BUILD;
            creep.memory.taskTarget = nearbySite[0].id;
            return true;
        }
        
        // 3. Réparation proche
        if (situation.repairStats.critical > 0 || situation.repairStats.damaged > 0) {
            let nearbyDamaged = pos.findInRange(FIND_STRUCTURES, nearbyRange, {
                filter: s => s.hits && s.hitsMax && s.hits < s.hitsMax * 0.8
            });
            
            if (nearbyDamaged.length > 0) {
                creep.memory.currentTask = TASKS.REPAIR;
                creep.memory.taskTarget = nearbyDamaged[0].id;
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * 🎯 NOUVEAU : Calcul intelligent des priorités
     */
    calculateSmartPriorities: function(room, situation, policy, creep) {
        let priorities = [];
        
        // 🔴 PRIORITÉS ABSOLUES
        
        // 1. Spawn/Extensions critiques (< 30%)
        if (situation.energyPercent < CONFIG.TASK_CONFIG.criticalEnergyThreshold) {
            priorities.push(TASKS.TRANSFER);
        }
        
        // 2. Controller decay imminent
        if (situation.controllerNearDecay) {
            priorities.push(TASKS.UPGRADE);
        }
        
        // 3. Structures critiques
        if (situation.repairStats.critical > 0) {
            priorities.push(TASKS.REPAIR);
        }
        
        // 4. Containers sources (vital)
        if (situation.missingContainers > 0) {
            priorities.push(TASKS.BUILD);
        }
        
        // 🟡 PRIORITÉS NORMALES (avec politique)
        
        let taskScores = {
            [TASKS.TRANSFER]: 0,
            [TASKS.BUILD]: 0,
            [TASKS.REPAIR]: 0,
            [TASKS.UPGRADE]: 0
        };
        
        // Transfer : basé sur l'urgence
        if (situation.needsTransfer) {
            taskScores[TASKS.TRANSFER] = 10 * situation.transferUrgency;
            
            // 🎯 BONUS : Si peu de workers font du transfer, augmenter le score
            if (situation.workerStats.transfer < 2 && situation.transferUrgency > 0.3) {
                taskScores[TASKS.TRANSFER] += 15;
            }
        }
        
        // Build : selon nombre de sites
        if (situation.constructionSites > 0) {
            taskScores[TASKS.BUILD] = 8 + Math.min(5, situation.constructionSites);
            
            // BONUS : Containers sources ultra-prioritaires
            if (situation.missingContainers > 0) {
                taskScores[TASKS.BUILD] += 10;
            }
        }
        
        // Repair : selon structures endommagées
        if (situation.repairStats.damaged > 0) {
            taskScores[TASKS.REPAIR] = 6 + situation.repairStats.damaged;
        }
        
        // Upgrade : score de base
        taskScores[TASKS.UPGRADE] = 5;
        
        // BONUS : Storage plein → upgrade plus
        if (situation.storageEnergy > 50000) {
            taskScores[TASKS.UPGRADE] += 5;
        }
        
        // 📊 Appliquer les modificateurs de politique
        taskScores[TASKS.TRANSFER] *= (policy.priorityModifiers.transfer || 1.0);
        taskScores[TASKS.BUILD] *= (policy.priorityModifiers.build || 1.0);
        taskScores[TASKS.REPAIR] *= (policy.priorityModifiers.repair || 1.0);
        taskScores[TASKS.UPGRADE] *= (policy.priorityModifiers.upgrade || 1.0);
        
        // 📍 NOUVEAU : Bonus géographique (favoriser tâches proches)
        taskScores = this.applyGeographicBonus(creep, taskScores, situation);
        
        // Trier par score
        let sortedTasks = Object.entries(taskScores)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
        
        // Ajouter les tâches non déjà présentes
        for (let task of sortedTasks) {
            if (!priorities.includes(task)) {
                priorities.push(task);
            }
        }
        
        // Forcer ratio minimum d'upgraders
        priorities = this.enforceMinimumUpgraders(room, priorities, policy);
        
        return priorities;
    },
    
    /**
     * 📍 NOUVEAU : Bonus selon proximité des tâches
     */
    applyGeographicBonus: function(creep, taskScores, situation) {
        let pos = creep.pos;
        let bonusRange = 15;  // Range pour bonus
        
        // Vérifier proximité controller (upgrade)
        if (creep.room.controller) {
            let distController = pos.getRangeTo(creep.room.controller);
            if (distController <= bonusRange) {
                let bonus = 1 + (bonusRange - distController) / bonusRange * 0.3;
                taskScores[TASKS.UPGRADE] *= bonus;
            }
        }
        
        // Vérifier proximité sites de construction (build)
        let nearbySites = pos.findInRange(FIND_CONSTRUCTION_SITES, bonusRange);
        if (nearbySites.length > 0) {
            taskScores[TASKS.BUILD] *= 1.3;
        }
        
        // Vérifier proximité structures endommagées (repair)
        let nearbyDamaged = pos.findInRange(FIND_STRUCTURES, bonusRange, {
            filter: s => s.hits && s.hitsMax && s.hits < s.hitsMax * 0.8
        });
        if (nearbyDamaged.length > 0) {
            taskScores[TASKS.REPAIR] *= 1.3;
        }
        
        return taskScores;
    },
    
    /**
     * 📍 NOUVEAU : Optimise l'exécution de la tâche (relais énergétique)
     */
    optimizeTaskExecution: function(creep) {
        let task = creep.memory.currentTask;
        
        // Si en tâche productive et peu d'énergie, chercher un relais proche
        if ([TASKS.BUILD, TASKS.REPAIR, TASKS.UPGRADE].includes(task)) {
            let energyPercent = creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
            
            // Si < 30% d'énergie, vérifier s'il y a un relais proche
            if (energyPercent < 0.3) {
                let target = Game.getObjectById(creep.memory.taskTarget);
                if (target) {
                    let nearbyRelay = this.findNearestRelay(creep, target.pos);
                    
                    if (nearbyRelay) {
                        // Mémoriser la tâche en cours
                        creep.memory.pausedTask = task;
                        creep.memory.pausedTarget = creep.memory.taskTarget;
                        
                        // Aller chercher de l'énergie au relais
                        creep.memory.currentTask = TASKS.HARVEST;
                        creep.memory.harvestSourceId = nearbyRelay.structure.id;
                        creep.memory.harvestMode = 'relay';
                    }
                }
            }
        }
        
        // Si on revient d'un relais, reprendre la tâche pausée
        if (task === TASKS.HARVEST && creep.memory.pausedTask) {
            let energyPercent = creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
            
            if (energyPercent >= 0.5) {
                creep.memory.currentTask = creep.memory.pausedTask;
                creep.memory.taskTarget = creep.memory.pausedTarget;
                creep.memory.pausedTask = null;
                creep.memory.pausedTarget = null;
            }
        }
    },
    
    /**
     * 📍 NOUVEAU : Trouve le relais le plus proche d'une position
     */
    findNearestRelay: function(creep, targetPos) {
        let relays = this.findEnergyRelays(creep.room);
        
        if (relays.length === 0) return null;
        
        // Calculer la distance de chaque relais par rapport au creep ET à la cible
        let bestRelay = null;
        let bestScore = Infinity;
        
        for (let relay of relays) {
            let distFromCreep = creep.pos.getRangeTo(relay.structure);
            let distFromTarget = targetPos.getRangeTo(relay.structure);
            
            // Score = distance totale (creep → relais → target)
            let score = distFromCreep + distFromTarget;
            
            // Bonus si beaucoup d'énergie
            score -= relay.energy / 1000;
            
            // Bonus selon priorité du type
            score -= relay.priority * 2;
            
            if (score < bestScore) {
                bestScore = score;
                bestRelay = relay;
            }
        }
        
        // Seulement si le détour est raisonnable (< 2x la distance directe)
        let directDist = creep.pos.getRangeTo(targetPos);
        if (bestScore < directDist * 2) {
            return bestRelay;
        }
        
        return null;
    },
    
    /**
     * 🎯 Distribution actuelle des workers
     */
    getWorkerDistribution: function(room) {
        let stats = {
            harvest: 0,
            transfer: 0,
            build: 0,
            repair: 0,
            upgrade: 0,
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
            }
        }
        
        return stats;
    },
    
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
            priorities = [TASKS.UPGRADE, ...priorities.filter(t => t !== TASKS.UPGRADE)];
        }
        
        return priorities;
    },
    
    /**
     * 🔧 MODIFIÉ : Harvest avec support relais
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
        
        // Vérifier si harvest direct autorisé
        if (CONFIG.TASK_CONFIG.strictSourceControl) {
            let availableSources = CONFIG.getAvailableSourcesForHarvest(creep.room);
            
            if (availableSources.length > 0) {
                let closestSource = creep.pos.findClosestByPath(availableSources);
                if (closestSource) {
                    creep.memory.harvestSourceId = closestSource.id;
                    creep.memory.harvestMode = 'source';
                    return true;
                }
            }
            
            creep.memory.harvestMode = 'waiting';
            return true;
        }
        
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
    
    findBestHarvestContainer: function(creep) {
        let room = creep.room;
        
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] >= 50
        });
        
        if (containers.length === 0) return null;
        
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
        
        candidates.sort((a, b) => {
            if (a.workers !== b.workers) return a.workers - b.workers;
            if (Math.abs(a.energy - b.energy) > 100) return b.energy - a.energy;
            return a.distance - b.distance;
        });
        
        return candidates[0].container;
    },
    
    /**
     * 🔧 MODIFIÉ : Build avec optimisation géographique
     */
    assignBuildTask: function(creep, situation) {
        let target = ConstructionManager.findPriorityConstructionSite(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.BUILD;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * 🔧 MODIFIÉ : Repair avec optimisation géographique
     */
    assignRepairTask: function(creep, situation) {
        let target = RepairManager.findRepairTarget(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.REPAIR;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    assignUpgradeTask: function(creep, situation) {
        creep.memory.currentTask = TASKS.UPGRADE;
        creep.memory.taskTarget = creep.room.controller.id;
        return true;
    },
    
    /**
     * 🔧 MODIFIÉ : Transfer optimisé géographiquement
     */
    assignTransferTask: function(creep, situation) {
        let pos = creep.pos;
        
        // Trouver la cible la plus proche en priorité
        let targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => (
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION ||
                s.structureType === STRUCTURE_TOWER
            ) && CONFIG.hasSpaceForEnergy(s)
        });
        
        if (targets.length === 0) {
            // Fallback : storage
            if (creep.room.storage && CONFIG.hasSpaceForEnergy(creep.room.storage)) {
                creep.memory.currentTask = TASKS.TRANSFER;
                creep.memory.taskTarget = creep.room.storage.id;
                return true;
            }
            return false;
        }
        
        // Trier par distance
        targets.sort((a, b) => pos.getRangeTo(a) - pos.getRangeTo(b));
        
        creep.memory.currentTask = TASKS.TRANSFER;
        creep.memory.taskTarget = targets[0].id;
        return true;
    },
    
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
     * 🔧 MODIFIÉ : Harvest avec support relais
     */
    doHarvest: function(creep) {
        let mode = creep.memory.harvestMode;
        
        if (mode === 'waiting') {
            let spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                creep.moveTo(spawn, {visualizePathStyle: {stroke: '#ffffff'}});
            }
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
        
        if (mode === 'container' || mode === 'relay') {
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 20,
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
        } else {
            if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 20,
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
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
            creep.moveTo(target, {
                reusePath: 15,
                visualizePathStyle: {stroke: '#ffffff'}
            });
        }
    },
    
    doRepair: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target || target.hits >= target.hitsMax) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                reusePath: 15,
                visualizePathStyle: {stroke: '#00ff00'}
            });
        }
    },
    
    doUpgrade: function(creep) {
        let controller = creep.room.controller;
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {
                reusePath: 20,
                visualizePathStyle: {stroke: '#ff00ff'}
            });
        }
    },
    
    doTransfer: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target || !CONFIG.hasSpaceForEnergy(target)) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                reusePath: 15,
                visualizePathStyle: {stroke: '#0000ff'}
            });
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
     * 📊 Statistiques enrichies
     */
    getTaskStats: function(room) {
        let stats = {
            harvest: 0,
            build: 0,
            repair: 0,
            upgrade: 0,
            transfer: 0,
            idle: 0,
            total: 0,
            usingRelays: 0  // 🎯 NOUVEAU : Compte les creeps utilisant des relais
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
            
            // Compter les usages de relais
            if (creep.memory.harvestMode === 'relay') {
                stats.usingRelays++;
            }
        }
        
        stats.activePolicy = CONFIG.getActivePolicy().name;
        
        return stats;
    }
};