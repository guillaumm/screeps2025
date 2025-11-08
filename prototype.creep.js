// prototype.creep - Version task-based ultralight avec support des workers

const TaskManager = require('module.taskManager');
const CONFIG = require('config.orchestrator');

// Creeps spécialisés gardent leurs rôles
var specializedRoles = {
    miner: require('role.miner'),
    lorry: require('role.lorry'),
    longDistanceHarvester: require('role.longDistanceHarvester')
};

Creep.prototype.runRole = function() {
    // 🔧 WORKERS POLYVALENTS utilisent le TaskManager
    if (this.memory.role === 'worker') {
        TaskManager.run(this);
        return;
    }
    
    // Rôles spécialisés (miners, lorries, LDH)
    if (specializedRoles[this.memory.role]) {
        specializedRoles[this.memory.role].run(this);
        return;
    }
    
    // 🔧 FALLBACK : Si rôle inconnu, utiliser TaskManager quand même
    console.log(`⚠️ Rôle inconnu pour ${this.name}: ${this.memory.role} - Using TaskManager`);
    TaskManager.run(this);
};

/**
 * Récupère de l'énergie selon la configuration
 * Gardé pour compatibilité avec rôles spécialisés
 */
Creep.prototype.getEnergy = function(useContainer, useSource) {
    let container;
    
    if (useContainer) {
        // CAS SPÉCIAL : Upgraders avec link dédié
        if (this.memory.role == 'upgrader' && CONFIG.CREEP_BEHAVIOR.upgradersUseDedicatedLink) {
            let upgraderLink = CONFIG.getUpgraderLink(this.room);
            
            if (upgraderLink && upgraderLink.store[RESOURCE_ENERGY] > 0) {
                if (this.withdraw(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    this.moveTo(upgraderLink);
                }
                return;
            }
        }
        
        // Chercher container/storage/link
        container = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (
                s.structureType == STRUCTURE_CONTAINER ||
                s.structureType == STRUCTURE_LINK ||
                s.structureType == STRUCTURE_STORAGE
            ) && s.store[RESOURCE_ENERGY] > CONFIG.ENERGY_CONFIG.minContainerEnergy
        });
        
        if (container != undefined) {
            if (this.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.moveTo(container, {reusePath: 50});
            }
            return;
        }
    }
    
    if (container == undefined && useSource) {
        // Ramasser énergie tombée
        let droppedEnergy = this.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        if (droppedEnergy) {
            if (this.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                this.moveTo(droppedEnergy);
            }
            return;
        }
        
        // Récolter à la source
        var source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source && this.harvest(source) == ERR_NOT_IN_RANGE) {
            this.moveTo(source, {reusePath: 50});
        }
    }
};