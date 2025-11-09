/*
Task Manager v3 - SEUILS D'ÉNERGIE CORRIGÉS
🔧 Fix: Seuils plus bas pour que les workers travaillent plus
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
        
        // 🔧 FIX: Seuils beaucoup plus bas
        let energyPercent = creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
        
        // Si VRAIMENT vide → forcer harvest
        if (energyPercent === 0 && creep.memory.currentTask !== TASKS.HARVEST) {
            creep.memory.currentTask = TASKS.HARVEST;
            creep.memory.taskTarget = null;
        }
        // Si assez d'énergie (> 10%) et en harvest → chercher une tâche productive
        else if (energyPercent > 0.1 && creep.memory.currentTask === TASKS.HARVEST) {
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
    
    assignBestTask: function(creep) {
        let room = creep.room;
        let energyPercent = creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
        
        // 🔧 FIX: Seulement si VIDE
        if (energyPercent === 0) {
            return this.assignHarvestTask(creep);
        }
        
        // 📊 Analyser la situation de la room
        let situation = this.analyzeRoomSituation(room);
        
        // Récupérer la politique active
        let policy = CONFIG.getActivePolicy();
        
        // Calculer les priorités
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
    
    analyzeRoomSituation: function(room) {
        let situation = {
            energyPercent: room.energyAvailable / room.energyCapacityAvailable,
            storageEnergy: room.storage ? room.storage.store[RESOURCE_ENERGY] : 0,
            
            repairStats: RepairManager.getRepairStats(room),
            missingContainers: ConstructionManager.countMissingSourceContainers(room),
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            
            controllerNearDecay: this.isControllerNearDecay(room),
            workerStats: this.getWorkerDistribution(room),
            
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
    
    calculateSmartPriorities: function(room, situation, policy, creep) {
        let priorities = [];
        
        // 🔴 PRIORITÉS ABSOLUES
        
        // 1. Spawn/Extensions critiques (< 50%)
        if (situation.energyPercent < 0.5) {
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
        
        // 🟡 PRIORITÉS NORMALES
        
        let taskScores = {
            [TASKS.TRANSFER]: 0,
            [TASKS.BUILD]: 0,
            [TASKS.REPAIR]: 0,
            [TASKS.UPGRADE]: 0
        };
        
        // Transfer : basé sur l'urgence
        if (situation.needsTransfer) {
            taskScores[TASKS.TRANSFER] = 10 * situation.transferUrgency;
        }
        
        // Build : selon nombre de sites
        if (situation.constructionSites > 0) {
            taskScores[TASKS.BUILD] = 8 + Math.min(5, situation.constructionSites);
            
            if (situation.missingContainers > 0) {
                taskScores[TASKS.BUILD] += 10;
            }
        }
        
        // 🔧 FIX: Repair même si peu de dégâts
        if (situation.repairStats.damaged > 0 || situation.repairStats.critical > 0) {
            taskScores[TASKS.REPAIR] = 6 + situation.repairStats.damaged + (situation.repairStats.critical * 2);
        }
        
        // 🔧 FIX: Upgrade TOUJOURS possible avec score de base plus élevé
        taskScores[TASKS.UPGRADE] = 8;
        
        // BONUS : Storage plein → upgrade plus
        if (situation.storageEnergy > 50000) {
            taskScores[TASKS.UPGRADE] += 5;
        }
        
        // Appliquer les modificateurs de politique
        taskScores[TASKS.TRANSFER] *= (policy.priorityModifiers.transfer || 1.0);
        taskScores[TASKS.BUILD] *= (policy.priorityModifiers.build || 1.0);
        taskScores[TASKS.REPAIR] *= (policy.priorityModifiers.repair || 1.0);
        taskScores[TASKS.UPGRADE] *= (policy.priorityModifiers.upgrade || 1.0);
        
        // Trier par score
        let sortedTasks = Object.entries(taskScores)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
        
        for (let task of sortedTasks) {
            if (!priorities.includes(task)) {
                priorities.push(task);
            }
        }
        
        // Forcer ratio minimum d'upgraders
        priorities = this.enforceMinimumUpgraders(room, priorities, policy);
        
        return priorities;
    },
    
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
    
    assignHarvestTask: function(creep) {
        creep.memory.currentTask = TASKS.HARVEST;
        
        // 🔧 FIX: Toujours essayer les containers/energy tombée en priorité
        let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType == RESOURCE_ENERGY && r.amount > 50
        });
        if (droppedEnergy) {
            creep.memory.harvestSourceId = droppedEnergy.id;
            creep.memory.harvestMode = 'pickup';
            return true;
        }
        
        let bestContainer = this.findBestHarvestContainer(creep);
        if (bestContainer) {
            creep.memory.harvestSourceId = bestContainer.id;
            creep.memory.harvestMode = 'container';
            return true;
        }
        
        // Harvest direct autorisé si pas de miners
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
    },
    
    findBestHarvestContainer: function(creep) {
        let room = creep.room;
        
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] >= 50
        });
        
        if (containers.length === 0) return null;
        
        return creep.pos.findClosestByPath(containers);
    },
    
    assignBuildTask: function(creep, situation) {
        let target = ConstructionManager.findPriorityConstructionSite(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.BUILD;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
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
    
    assignTransferTask: function(creep, situation) {
        let targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => (
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION ||
                s.structureType === STRUCTURE_TOWER
            ) && CONFIG.hasSpaceForEnergy(s)
        });
        
        if (targets.length === 0) {
            if (creep.room.storage && CONFIG.hasSpaceForEnergy(creep.room.storage)) {
                creep.memory.currentTask = TASKS.TRANSFER;
                creep.memory.taskTarget = creep.room.storage.id;
                return true;
            }
            return false;
        }
        
        let closest = creep.pos.findClosestByPath(targets);
        if (closest) {
            creep.memory.currentTask = TASKS.TRANSFER;
            creep.memory.taskTarget = closest.id;
            return true;
        }
        
        return false;
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
        
        // 🔧 FIX: Support pickup
        if (mode === 'pickup') {
            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 20,
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
        } else if (mode === 'container') {
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
        
        stats.activePolicy = CONFIG.getActivePolicy().name;
        
        return stats;
    }
};