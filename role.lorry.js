// role.lorry - Version ultra-simplifiée qui FONCTIONNE

const CONFIG = require('config.orchestrator');

module.exports = {
    /** @param {Creep} creep */
    run: function(creep) {
        
        let currentEnergy = creep.store[RESOURCE_ENERGY];
        let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
        
        // 🔧 États simples: working = a de l'énergie à déposer
        if (creep.memory.working && currentEnergy === 0) {
            creep.memory.working = false;
        }
        else if (!creep.memory.working && currentEnergy === maxEnergy) {
            creep.memory.working = true;
        }

        // ========== MODE WORKING: DÉPOSER L'ÉNERGIE ==========
        if (creep.memory.working) {
            
            // 1. Spawn et Extensions vides
            let target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: (s) => (
                    s.structureType === STRUCTURE_SPAWN ||
                    s.structureType === STRUCTURE_EXTENSION
                ) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            // 2. Tours
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: (s) => s.structureType === STRUCTURE_TOWER && 
                                   s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }
            
            // 3. Storage
            if (!target && creep.room.storage) {
                if (creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = creep.room.storage;
                }
            }

            // Transférer
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
        // ========== MODE HARVEST: RÉCUPÉRER L'ÉNERGIE ==========
        else {
            
            // 1. PRIORITÉ: Énergie tombée par terre
            let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
            });
            
            if (droppedEnergy) {
                if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return;
            }
            
            // 2. Tombes
            let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                filter: t => t.store[RESOURCE_ENERGY] > 50
            });
            
            if (tombstone) {
                if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return;
            }
            
            // 3. Containers avec énergie (utilise la constante globale)
            let container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                            s.store[RESOURCE_ENERGY] >= CONFIG.MIN_CONTAINER_ENERGY
            });

            if (container) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {
                        reusePath: 10,
                        visualizePathStyle: {stroke: '#ffaa00'}
                    });
                }
                return;
            }
            
            // 4. Storage (en dernier recours)
            if (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
                if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.storage, {
                        reusePath: 10,
                        visualizePathStyle: {stroke: '#ffaa00'}
                    });
                }
                return;
            }
            
            // 5. Rien trouvé: attendre près du spawn
            let spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                creep.moveTo(spawn);
            }
        }
    }
};