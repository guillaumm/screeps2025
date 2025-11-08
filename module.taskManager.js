/*
Task Manager - Architecture task-based pour creeps polyvalents
Remplace les 7 fichiers de rôles par un système de priorités dynamiques
*/

const CONFIG = require('config.orchestrator');
const RepairManager = require('module.repairManager');
const ConstructionManager = require('module.constructionManager');

// Définition des tasks disponibles avec leurs priorités
const TASKS = {
    HARVEST: 'harvest',
    BUILD: 'build',
    REPAIR: 'repair',
    UPGRADE: 'upgrade',
    TRANSFER: 'transfer',
    PICKUP: 'pickup'
};

module.exports = {
    
    /**
     * Point d'entrée principal : assigne et exécute la meilleure task
     * Remplace tous les role.*.run()
     */
    run: function(creep) {
        // Gestion état énergétique
        if (creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.currentTask = null;
            creep.memory.taskTarget = null;
        }
        
        // Si pas de task ou task terminée, en trouver une nouvelle
        if (!creep.memory.currentTask || this.isTaskComplete(creep)) {
            this.assignBestTask(creep);
        }
        
        // Exécuter la task actuelle
        this.executeTask(creep);
    },
    
    /**
     * Trouve et assigne la meilleure task selon les priorités
     */
    assignBestTask: function(creep) {
        let room = creep.room;
        
        // Si vide d'énergie → récolter
        if (creep.store[RESOURCE_ENERGY] === 0) {
            return this.assignHarvestTask(creep);
        }
        
        // Sinon, calculer les priorités selon l'état de la room
        let priorities = this.calculateTaskPriorities(room);
        
        // Essayer chaque task par ordre de priorité
        for (let taskType of priorities) {
            let assigned = false;
            
            switch(taskType) {
                case TASKS.BUILD:
                    assigned = this.assignBuildTask(creep);
                    break;
                case TASKS.REPAIR:
                    assigned = this.assignRepairTask(creep);
                    break;
                case TASKS.UPGRADE:
                    assigned = this.assignUpgradeTask(creep);
                    break;
                case TASKS.TRANSFER:
                    assigned = this.assignTransferTask(creep);
                    break;
            }
            
            if (assigned) return;
        }
        
        // Fallback : upgrade
        this.assignUpgradeTask(creep);
    },
    
    /**
     * Calcule les priorités dynamiques selon l'état de la room
     */
    calculateTaskPriorities: function(room) {
        let priorities = [];
        
        // 1. PRIORITÉ ABSOLUE : Containers sources en construction
        let missingContainers = ConstructionManager.countMissingSourceContainers(room);
        if (missingContainers > 0) {
            priorities.push(TASKS.BUILD);
        }
        
        // 2. Structures critiques à réparer (< 25% HP)
        let criticalRepairs = RepairManager.getRepairStats(room).critical;
        if (criticalRepairs > 0) {
            priorities.push(TASKS.REPAIR);
        }
        
        // 3. Transfer si spawn/extensions vides
        let energyPercent = room.energyAvailable / room.energyCapacityAvailable;
        if (energyPercent < 0.8) {
            priorities.push(TASKS.TRANSFER);
        }
        
        // 4. Constructions normales
        if (room.find(FIND_CONSTRUCTION_SITES).length > 0) {
            if (!priorities.includes(TASKS.BUILD)) {
                priorities.push(TASKS.BUILD);
            }
        }
        
        // 5. Réparations normales
        if (RepairManager.needsRepair(room)) {
            if (!priorities.includes(TASKS.REPAIR)) {
                priorities.push(TASKS.REPAIR);
            }
        }
        
        // 6. Upgrade par défaut
        priorities.push(TASKS.UPGRADE);
        
        return priorities;
    },
    
    /**
     * Assigne une task de récolte
     */
    assignHarvestTask: function(creep) {
        creep.memory.currentTask = TASKS.HARVEST;
        creep.memory.taskTarget = null;
        return true;
    },
    
    /**
     * Assigne une task de construction
     */
    assignBuildTask: function(creep) {
        let target = ConstructionManager.findPriorityConstructionSite(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.BUILD;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * Assigne une task de réparation
     */
    assignRepairTask: function(creep) {
        let target = RepairManager.findRepairTarget(creep.room, creep);
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.REPAIR;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * Assigne une task d'upgrade
     */
    assignUpgradeTask: function(creep) {
        creep.memory.currentTask = TASKS.UPGRADE;
        creep.memory.taskTarget = creep.room.controller.id;
        return true;
    },
    
    /**
     * Assigne une task de transfer
     */
    assignTransferTask: function(creep) {
        let target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: s => (
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION
            ) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        if (!target) return false;
        
        creep.memory.currentTask = TASKS.TRANSFER;
        creep.memory.taskTarget = target.id;
        return true;
    },
    
    /**
     * Exécute la task actuelle
     */
    executeTask: function(creep) {
        let task = creep.memory.currentTask;
        
        switch(task) {
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
     * Exécution : Récolte d'énergie
     */
    doHarvest: function(creep) {
        // Utiliser la méthode prototype existante
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
        if (!target) {
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
            creep.moveTo(controller, {reusePath: 15});
        }
    },
    
    /**
     * Exécution : Transfer
     */
    doTransfer: function(creep) {
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target) {
            creep.memory.currentTask = null;
            return;
        }
        
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 15});
        }
    },
    
    /**
     * Vérifie si une task est terminée
     */
    isTaskComplete: function(creep) {
        let task = creep.memory.currentTask;
        
        // Harvest terminé si plein
        if (task === TASKS.HARVEST) {
            return creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
        }
        
        // Autres tasks terminées si vide OU target disparue
        if (creep.store[RESOURCE_ENERGY] === 0) {
            return true;
        }
        
        let target = Game.getObjectById(creep.memory.taskTarget);
        if (!target) return true;
        
        // Build terminé si progressTotal atteint
        if (task === TASKS.BUILD) {
            return target.progress >= target.progressTotal;
        }
        
        // Repair terminé si HP max
        if (task === TASKS.REPAIR) {
            return target.hits >= target.hitsMax;
        }
        
        // Transfer terminé si target pleine
        if (task === TASKS.TRANSFER) {
            return target.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
        }
        
        return false;
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
            if (creep.memory.role === 'miner' || creep.memory.role === 'lorry') continue;
            
            let task = creep.memory.currentTask;
            if (task) {
                stats[task] = (stats[task] || 0) + 1;
            } else {
                stats.idle++;
            }
        }
        
        return stats;
    }
};