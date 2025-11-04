// role.lorry - Version refactorée avec configuration centralisée

const CONFIG = require('config.orchestrator');

module.exports = {
    /** @param {Creep} creep */
    run: function(creep) {
        
        // Gestion des états
        if (creep.memory.working == true && creep.carry.energy == 0) {
            creep.memory.working = false;
        }
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
        }

        // Si le creep doit transférer de l'énergie
        if (creep.memory.working == true) {
            
            // Obtenir les types de structures cibles depuis la config
            let targetTypes = CONFIG.getLorryDepositTargets();
            
            // Chercher la structure la plus proche qui a besoin d'énergie
            var structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: (s) => targetTypes.includes(s.structureType) && 
                               s.energy < s.energyCapacity
            });

            // Si aucune structure trouvée, essayer le storage
            if (structure == undefined) {
                structure = creep.room.storage;
            }

            // Si on a trouvé une cible
            if (structure != undefined) {
                if (creep.transfer(structure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(structure);
                }
            }
        }
        // Si le creep doit récupérer de l'énergie
        else {
            
            // 1. Récupérer dans les tombes si configuré
            if (CONFIG.CREEP_BEHAVIOR.lorriesLootTombstones) {
                let tombstone = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
                    filter: t => t.store[RESOURCE_ENERGY] > 0
                });
                
                if (tombstone) {
                    if (creep.withdraw(tombstone, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(tombstone);
                    }
                    return;
                }
            }
            
            // 2. Ramasser l'énergie tombée si configuré
            if (CONFIG.CREEP_BEHAVIOR.lorriesPickupDroppedEnergy) {
                let droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if (droppedEnergy) {
                    if (creep.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(droppedEnergy);
                    }
                    return;
                }
            }
            
            // 3. Chercher un container/link avec assez d'énergie
            let container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (
                    s.structureType == STRUCTURE_CONTAINER ||
                    s.structureType == STRUCTURE_LINK
                ) && s.store[RESOURCE_ENERGY] > CONFIG.CREEP_BEHAVIOR.lorryMinContainerEnergy
            });

            // Si pas de container, essayer le storage
            if (container == undefined) {
                container = creep.room.storage;
            }

            // Si on a trouvé une source d'énergie
            if (container != undefined) {
                if (creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {reusePath: 50});
                }
            }
        }
    }
};