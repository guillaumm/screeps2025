/*
Task Manager - UPGRADE EN PERMANENCE
🎯 Workers actifs dès qu'ils ont de l'énergie
⚡ Upgrade par défaut si pas d'autre priorité
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
        // 🔧 DEBUG: Log pour voir ce qui se passe
        if (Game.time % 10 === 0) {
            let energy = creep.store[RESOURCE_ENERGY];
            let task = creep.memory.currentTask;
            console.log(`[${creep.name}] Energy: ${energy}, Task: ${task || 'NONE'}`);
        }
        
        // Affichage de la tâche
        if (CONFIG.TASK_CONFIG.displayTasksWithSay && 
            Game.time % CONFIG.TASK_CONFIG.sayFrequency === 0) {
            let emoji = this.getTaskEmoji(creep.memory.currentTask);
            creep.say(emoji);
        }
        
        let currentEnergy = creep.store[RESOURCE_ENERGY];
        let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
        
        // 🔧 LOGIQUE SIMPLIFIÉE: Vide = harvest, Sinon = travail
        if (currentEnergy === 0 && creep.memory.currentTask !== TASKS.HARVEST) {
            creep.memory.currentTask = TASKS.HARVEST;
            creep.memory.taskTarget = null;
            console.log(`[${creep.name}] 🔄 Switch to HARVEST (empty)`);
        }
        else if (currentEnergy > 0 && creep.memory.currentTask === TASKS.HARVEST) {
            // Dès qu'on a de l'énergie, on travaille
            creep.memory.currentTask = null;
            creep.memory.taskTarget = null;
            console.log(`[${creep.name}] 🔄 Switch to WORK (has energy: ${currentEnergy})`);
        }
        
        // Si pas de tâche ou tâche terminée, en assigner une
        if (!creep.memory.currentTask || this.isTaskComplete(creep)) {
            console.log(`[${creep.name}] 🎯 Assigning new task...`);
            this.assignBestTask(creep);
        }
        
        // Exécuter la tâche
        this.executeTask(creep);
    },
    
    assignBestTask: function(creep) {
        let room = creep.room;
        let currentEnergy = creep.store[RESOURCE_ENERGY];
        
        console.log(`[${creep.name}] assignBestTask called, energy: ${currentEnergy}`);
        
        // Si vide → harvest
        if (currentEnergy === 0) {
            console.log(`[${creep.name}] ➜ HARVEST (no energy)`);
            return this.assignHarvestTask(creep);
        }
        
        // 📊 Analyser la situation
        let situation = this.analyzeRoomSituation(room);
        let policy = CONFIG.getActivePolicy();
        
        console.log(`[${creep.name}] Situation: energy=${situation.energyPercent.toFixed(2)}, repairs=${situation.repairStats.damaged}, sites=${situation.constructionSites}`);
        
        // 🔴 CAS SPÉCIAL: Seul creep vivant
        let totalCreeps = _.filter(Game.creeps, c => c.room.name === room.name).length;
        if (totalCreeps === 1) {
            console.log(`[${creep.name}] ⚠️ SEUL CREEP mode`);
            if (situation.energyPercent < 0.5) {
                if (this.assignTransferTask(creep, situation)) {
                    console.log(`[${creep.name}] ➜ TRANSFER (solo mode)`);
                    return;
                }
            }
            console.log(`[${creep.name}] ➜ UPGRADE (solo mode)`);
            return this.assignUpgradeTask(creep, situation);
        }
        
        // 🔴 PRIORITÉS ABSOLUES
        
        // 1. Spawn/Extensions critiques (< 30%)
        if (situation.energyPercent < CONFIG.TASK_CONFIG.criticalEnergyThreshold) {
            if (this.assignTransferTask(creep, situation)) {
                console.log(`[${creep.name}] ➜ TRANSFER (critical energy)`);
                return;
            }
        }
        
        // 2. Structures critiques (< 30% HP)
        if (situation.repairStats.critical > 0) {
            if (this.assignRepairTask(creep, situation)) {
                console.log(`[${creep.name}] ➜ REPAIR (critical)`);
                return;
            }
        }
        
        // 3. Containers sources manquants
        if (situation.missingContainers > 0) {
            if (this.assignBuildTask(creep, situation)) {
                console.log(`[${creep.name}] ➜ BUILD (containers)`);
                return;
            }
        }
        
        // 🟡 PRIORITÉS NORMALES (basées sur politique)
        
        let priorities = this.calculatePriorities(situation, policy);
        console.log(`[${creep.name}] Priorities: ${priorities.join(' > ')}`);
        
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
            
            if (assigned) {
                console.log(`[${creep.name}] ➜ ${taskType}`);
                return;
            }
        }
        
        // 🎯 FALLBACK GARANTI: UPGRADE (toujours possible)
        console.log(`[${creep.name}] ➜ UPGRADE (fallback)`);
        this.assignUpgradeTask(creep, situation);
    },
    
    analyzeRoomSituation: function(room) {
        let situation = {
            energyPercent: room.energyAvailable / room.energyCapacityAvailable,
            storageEnergy: room.storage ? room.storage.store[RESOURCE_ENERGY] : 0,
            
            repairStats: RepairManager.getRepairStats(room),
            missingContainers: ConstructionManager.countMissingSourceContainers(room),
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            
            workerStats: this.getWorkerDistribution(room),
            
            needsTransfer: false,
            transferUrgency: 0
        };
        
        // Calculer urgence transfer
        let emptyStructures = room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || 
                         s.structureType === STRUCTURE_EXTENSION) &&
                         CONFIG.hasSpaceForEnergy(s)
        }).length;
        
        let totalStructures = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_SPAWN || 
                        s.structureType === STRUCTURE_EXTENSION
        }).length;
        
        situation.needsTransfer = emptyStructures > 0;
        situation.transferUrgency = emptyStructures / Math.max(1, totalStructures);
        
        return situation;
    },
    
    calculatePriorities: function(situation, policy) {
        let taskScores = {
            [TASKS.TRANSFER]: 0,
            [TASKS.BUILD]: 0,
            [TASKS.REPAIR]: 0,
            [TASKS.UPGRADE]: 0
        };
        
        // Transfer
        if (situation.needsTransfer) {
            taskScores[TASKS.TRANSFER] = 10 * situation.transferUrgency;
        }
        
        // Build
        if (situation.constructionSites > 0) {
            taskScores[TASKS.BUILD] = 5 + Math.min(10, situation.constructionSites * 2);
        }
        
        // Repair
        if (situation.repairStats.damaged > 0) {
            taskScores[TASKS.REPAIR] = 5 + situation.repairStats.damaged;
        }
        
        // 🎯 UPGRADE: Score de base ÉLEVÉ
        taskScores[TASKS.UPGRADE] = 10;
        
        // BONUS: Storage plein → upgrade encore plus
        if (situation.storageEnergy > 50000) {
            taskScores[TASKS.UPGRADE] += 10;
        }
        
        // Appliquer modificateurs de politique
        for (let task in taskScores) {
            let modifier = policy.priorityModifiers[task] || 1.0;
            taskScores[task] *= modifier;
        }
        
        // Trier par score décroissant
        let sortedTasks = Object.entries(taskScores)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
        
        // Forcer ratio minimum d'upgraders
        return this.enforceMinimumUpgraders(situation, sortedTasks, policy);
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
    
    enforceMinimumUpgraders: function(situation, priorities, policy) {
        let totalWorkers = situation.workerStats.total;
        if (totalWorkers === 0) return priorities;
        
        let currentUpgraders = situation.workerStats.upgrade;
        let requiredUpgraders = Math.ceil(totalWorkers * policy.minUpgradersRatio);
        
        if (currentUpgraders < requiredUpgraders) {
            // Mettre upgrade en premier
            priorities = [TASKS.UPGRADE, ...priorities.filter(t => t !== TASKS.UPGRADE)];
        }
        
        return priorities;
    },
    
    // ========== ASSIGNATION DES TÂCHES ==========
    
    assignHarvestTask: function(creep) {
        creep.memory.currentTask = TASKS.HARVEST;
        
        // 1. Énergie tombée par terre (priorité absolue)
        let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType == RESOURCE_ENERGY && r.amount > 50
        });
        if (droppedEnergy) {
            creep.memory.harvestSourceId = droppedEnergy.id;
            creep.memory.harvestMode = 'pickup';
            return true;
        }
        
        // 2. Containers avec énergie
        let container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] >= CONFIG.MIN_CONTAINER_ENERGY
        });
        if (container) {
            creep.memory.harvestSourceId = container.id;
            creep.memory.harvestMode = 'container';
            return true;
        }
        
        // 3. Storage
        if (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
            creep.memory.harvestSourceId = creep.room.storage.id;
            creep.memory.harvestMode = 'storage';
            return true;
        }
        
        // 4. Sources (si autorisé)
        let availableSources = CONFIG.getAvailableSourcesForHarvest(creep.room);
        if (availableSources.length > 0) {
            let closestSource = creep.pos.findClosestByPath(availableSources);
            if (closestSource) {
                creep.memory.harvestSourceId = closestSource.id;
                creep.memory.harvestMode = 'source';
                return true;
            }
        }
        
        // 5. Attendre
        creep.memory.harvestMode = 'waiting';
        return true;
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
        // Priorité: Spawn → Extensions → Tours → Storage
        
        let targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => (
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION
            ) && CONFIG.hasSpaceForEnergy(s)
        });
        
        if (targets.length === 0) {
            // Tours
            targets = creep.room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER && 
                            CONFIG.hasSpaceForEnergy(s)
            });
        }
        
        if (targets.length === 0) {
            // Storage
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
    
    // ========== EXÉCUTION DES TÂCHES ==========
    
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
            if (Game.time % 10 === 0) {
                creep.memory.currentTask = null;
            }
            return;
        }
        
        let target = Game.getObjectById(creep.memory.harvestSourceId);
        if (!target) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (mode === 'pickup') {
            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        } else if (mode === 'container' || mode === 'storage') {
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        } else if (mode === 'source') {
            if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
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
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
        }
    },
    
    doRepair: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target || target.hits >= target.hitsMax) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}});
        }
    },
    
    doUpgrade: function(creep) {
        let controller = creep.room.controller;
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {visualizePathStyle: {stroke: '#ff00ff'}});
        }
    },
    
    doTransfer: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target || !CONFIG.hasSpaceForEnergy(target)) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#0000ff'}});
        }
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