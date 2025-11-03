// role.miner
module.exports = {
    // a function to run the logic for this role
    run: function (creep) {
        
        let source = Game.getObjectById(creep.memory.sourceId);
        
        // Vérifier que la source existe
        if (!source) {
            console.log('[MINER] ' + creep.name + ' : Source introuvable !');
            return;
        }
        
        let linkFrom = Game.getObjectById(creep.memory.linkId);
        let droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        
        // Chercher le container près de la source (range 2 au lieu de 1)
        let container = source.pos.findInRange(FIND_STRUCTURES, 1, { 
            filter: s => s.structureType == STRUCTURE_CONTAINER
        })[0];
        
        // Si pas de container, le miner ne peut pas travailler
        if (!container) {
            console.log('[MINER] ' + creep.name + ' : Pas de container près de la source !');
            // Se déplacer vers la source en attendant
            if (creep.pos.getRangeTo(source) > 1) {
                creep.moveTo(source);
            }
            return;
        }

        // Si le miner est sur le container
        if (creep.pos.isEqualTo(container.pos)) {
            if (source.energy > 0) {
                creep.harvest(source);
                if (droppedEnergy && creep.pos.isNearTo(droppedEnergy)) {
                    creep.pickup(droppedEnergy);
                }
            } else {
                // Si source vide, récupérer l'énergie du container
                if (container.store[RESOURCE_ENERGY] > 0) {
                    creep.withdraw(container, RESOURCE_ENERGY);
                }
                if (droppedEnergy && creep.pos.isNearTo(droppedEnergy)) {
                    creep.pickup(droppedEnergy);
                }
            }
            
            // Transférer vers un link si disponible et s'il a de la place
            if (linkFrom && linkFrom.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                creep.transfer(linkFrom, RESOURCE_ENERGY);
            }
        } else {
            // Se déplacer vers le container
            creep.moveTo(container);
        }
    }
};