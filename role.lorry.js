// role.lorry - Version corrigée avec gestion appropriée des structures

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
            
            // Vérifier si on a assez d'énergie pour déposer
            if (creep.carry.energy < CONFIG.LORRY_BEHAVIOR.minEnergyToDeposit) {
                return; // Attendre d'avoir plus d'énergie
            }
            
            // Obtenir les types de structures cibles depuis la config
            let targetTypes = CONFIG.getLorryDepositTargets();
            
            // 🔧 FIX: Utiliser la méthode qui gère les deux types de structures
            var structure;
            
            if (CONFIG.LORRY_BEHAVIOR.prioritizeSpawnExtension) {
                // Prioriser spawn et extensions
                structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: (s) => (
                        s.structureType == STRUCTURE_SPAWN ||
                        s.structureType == STRUCTURE_EXTENSION ||
                        s.structureType == STRUCTURE_TOWER
                    ) && CONFIG.hasSpaceForEnergy(s)
                });
                
                // Si rien trouvé, chercher storage/links
                if (!structure) {
                    structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                        filter: (s) => targetTypes.includes(s.structureType) && 
                                       CONFIG.hasSpaceForEnergy(s)
                    });
                }
            } else {
                // Chercher la cible la plus proche de tous types
                if (CONFIG.LORRY_BEHAVIOR.preferClosestTarget) {
                    structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                        filter: (s) => targetTypes.includes(s.structureType) && 
                                       CONFIG.hasSpaceForEnergy(s)
                    });
                } else {
                    // Chercher la structure la plus vide
                    let candidates = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: (s) => targetTypes.includes(s.structureType) && 
                                       CONFIG.hasSpaceForEnergy(s)
                    });
                    
                    if (candidates.length > 0) {
                        candidates.sort((a, b) => 
                            CONFIG.getEnergyPercent(a) - CONFIG.getEnergyPercent(b)
                        );
                        structure = candidates[0];
                    }
                }
            }

            // Si on a trouvé une cible
            if (structure != undefined) {
                if (creep.transfer(structure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(structure);
                }
            } else if (CONFIG.LORRY_BEHAVIOR.returnToStorageWhenFull && creep.room.storage) {
                // Retourner au storage si tout est plein
                if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.storage);
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