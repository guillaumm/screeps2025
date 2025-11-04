// prototype.creep - Version refactorée avec configuration centralisée

const CONFIG = require('config.orchestrator');

var roles = {
    harvester: require('role.harvester'),
    upgrader: require('role.upgrader'),
    builder: require('role.builder'),
    repairer: require('role.repairer'),
    longDistanceHarvester: require('role.longDistanceHarvester'),
    miner: require('role.miner'),
    lorry: require('role.lorry')
};

Creep.prototype.runRole = function() {
    roles[this.memory.role].run(this);
};

/**
 * Récupère de l'énergie selon la configuration
 * @param {bool} useContainer - Utiliser containers/storage/links
 * @param {bool} useSource - Utiliser les sources directement
 */
Creep.prototype.getEnergy = function(useContainer, useSource) {
    let container;
    
    // Si le creep doit chercher dans les containers/storage/links
    if (useContainer) {
        
        // CAS SPÉCIAL : Upgraders avec link dédié
        if (this.memory.role == 'upgrader' && CONFIG.CREEP_BEHAVIOR.upgradersUseDedicatedLink) {
            let upgraderLink = CONFIG.getUpgraderLink(this.room);
            
            if (upgraderLink && upgraderLink.store[RESOURCE_ENERGY] > 0) {
                if (this.withdraw(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    this.moveTo(upgraderLink);
                }
                return; // On a trouvé le link, pas besoin de chercher ailleurs
            }
        }
        
        // Chercher le container/storage/link le plus proche avec assez d'énergie
        container = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (
                s.structureType == STRUCTURE_CONTAINER ||
                s.structureType == STRUCTURE_LINK ||
                s.structureType == STRUCTURE_STORAGE
            ) && s.store[RESOURCE_ENERGY] > CONFIG.ENERGY_CONFIG.minContainerEnergy
        });
        
        // Si on a trouvé un container
        if (container != undefined) {
            if (this.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.moveTo(container, {reusePath: 50});
            }
            return;
        }
    }
    
    // Si pas de container trouvé et qu'on peut utiliser les sources
    if (container == undefined && useSource) {
        
        // D'abord essayer de ramasser l'énergie tombée
        let droppedEnergy = this.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        if (droppedEnergy) {
            if (this.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                this.moveTo(droppedEnergy);
            }
            return;
        }
        
        // Ensuite récolter à la source
        var source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source && this.harvest(source) == ERR_NOT_IN_RANGE) {
            this.moveTo(source, {reusePath: 50});
        }
    }
};