
// role.miner
module.exports = {
    // a function to run the logic for this role
    run: function (creep) {
        
        let source = Game.getObjectById(creep.memory.sourceId);
        let linkFrom = Game.getObjectById(creep.memory.linkId);
        let droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        let container = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType == STRUCTURE_CONTAINER})[0];

        //console.log(source);
        //console.log(container);
        if (creep.pos.isEqualTo(container.pos)) {
        //if (true) {
            if (source.energy>0){
                creep.harvest(source);
                creep.pickup(droppedEnergy);
            }
            else {     //si source vide
                creep.withdraw(container, RESOURCE_ENERGY);
                creep.pickup(droppedEnergy);
            }
            
            if (linkFrom != undefined){
                if (linkFrom.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.transfer(linkFrom, RESOURCE_ENERGY);
                }
            }
        }        
        
        else {
            creep.moveTo(container);
        }

    }
        // if creep is not on top of the container
};

