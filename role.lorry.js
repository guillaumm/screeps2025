// role.lorry - Version CORRIGÉE avec bon API

const CONFIG = require('config.orchestrator');

module.exports = {
    /** @param {Creep} creep */
    run: function(creep) {
        
        // 🔧 FIX: Utiliser le bon API (store au lieu de carry)
        let currentEnergy = creep.store[RESOURCE_ENERGY];
        let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
        
        // Gestion des états
        if (creep.memory.working == true && currentEnergy == 0) {
            creep.memory.working = false;
        }
        else if (creep.memory.working == false && currentEnergy == maxEnergy) {
            creep.memory.working = true;
        }

        // Si le creep doit transférer de l'énergie
        if (creep.memory.working == true) {
            
            // Vérifier si on a assez d'énergie pour déposer
            if (currentEnergy < CONFIG.LORRY_BEHAVIOR.minEnergyToDeposit) {
                return; // Attendre d'avoir plus d'énergie
            }
            
            // 🎯 PRIORITÉ 1: Spawn et Extensions vides
            var structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: (s) => (
                    s.structureType == STRUCTURE_SPAWN ||
                    s.structureType == STRUCTURE_EXTENSION
                ) && CONFIG.hasSpaceForEnergy(s)
            });
            
            // 🎯 PRIORITÉ 2: Tours
            if (!structure) {
                structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: (s) => s.structureType == STRUCTURE_TOWER && 
                                   CONFIG.hasSpaceForEnergy(s)
                });
            }
            
            // 🎯 PRIORITÉ 3: Storage
            if (!structure && creep.room.storage && CONFIG.hasSpaceForEnergy(creep.room.storage)) {
                structure = creep.room.storage;
            }

            // Si on a trouvé une cible
            if (structure != undefined) {
                if (creep.transfer(structure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(structure, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
        // Si le creep doit récupérer de l'énergie
        else {
            
            // 1. Ramasser l'énergie tombée en priorité
            let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType == RESOURCE_ENERGY && r.amount > 50
            });
            if (droppedEnergy) {
                if (creep.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return;
            }
            
            // 2. Récupérer dans les tombes
            let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                filter: t => t.store[RESOURCE_ENERGY] > 50
            });
            if (tombstone) {
                if (creep.withdraw(tombstone, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return;
            }
            
            // 3. Chercher un container avec assez d'énergie
            let container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (
                    s.structureType == STRUCTURE_CONTAINER ||
                    s.structureType == STRUCTURE_LINK
                ) && s.store[RESOURCE_ENERGY] > 100
            });

            // Si pas de container, essayer le storage
            if (container == undefined && creep.room.storage) {
                if (creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
                    container = creep.room.storage;
                }
            }

            // Si on a trouvé une source d'énergie
            if (container != undefined) {
                if (creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {
                        reusePath: 50,
                        visualizePathStyle: {stroke: '#ffaa00'}
                    });
                }
            }
        }
    }
};