

// role.lorry

module.exports = {
    // a function to run the logic for this role
    /** @param {Creep} creep */
    run: function(creep) {
        // if creep is bringing energy to a structure but has no energy left
        if (creep.memory.working == true && creep.carry.energy == 0) {
            // switch state
            creep.memory.working = false;
        }
        // if creep is harvesting energy but is full
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            // switch state
            creep.memory.working = true;
        }
        
        

        // if creep is supposed to transfer energy to a structure
        if (creep.memory.working == true) {
            // find closest spawn, extension or tower which is not full
            var structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                // the second argument for findClosestByPath is an object which takes
                // a property called filter which can be a function
                // we use the arrow operator to define it
                filter: (s) => (s.structureType == STRUCTURE_SPAWN
                             || s.structureType == STRUCTURE_EXTENSION
                             //|| s.structureType == STRUCTURE_LINK
                             || s.structureType == STRUCTURE_STORAGE
                             || s.structureType == STRUCTURE_TOWER
                            ) && s.energy < s.energyCapacity
            });
            
            

            if (structure == undefined) {
                structure = creep.room.storage;
            }
            
            

            // if we found one RESOURCE_GHODIUM_OXIDE
            if (structure != undefined) {
                // try to transfer energy, if it is not in range
                if (creep.transfer(structure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    // move towards it
                    creep.moveTo(structure);
                    
                    
                }
/*                if (creep.transfer(structure, RESOURCE_GHODIUM_OXIDE) == ERR_NOT_IN_RANGE) {
                    // move towards it
                    creep.moveTo(structure);
                }*/
            }
        }
        // if creep is supposed to get energy
        else {
            
            
            /*if(creep.signController(creep.room.controller, "merci c'est bon") == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller);
            }*/
            
            // find closest container
            let container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (
                    s.structureType == STRUCTURE_CONTAINER
                    //)
                    //|| s.structureType == STRUCTURE_STORAGE)
                    || s.structureType == STRUCTURE_LINK)
                    && s.store[RESOURCE_ENERGY] > 1
            });

            
            const targets = creep.room.find(FIND_DROPPED_RESOURCES);
            if(targets.length) {
                creep.moveTo(targets[0]);
                creep.pickup(targets[0]);
            }



            let tombe = creep.pos.findClosestByRange(FIND_TOMBSTONES);
                if(tombe) {
                            //let stored_resources = _.filter(Object.keys(tombe.store), resource => tombe.store[resource] > 0)    
                            //let stored_resources = _.filter(Object.keys(creep.room.storage.store), resource => creep.room.storage.store[resource] > 0)    
                            //creep.withdraw(creep.room.storage.store, stored_resources[0])
                            //console.log('___________________storedres ' + stored_resources)
                            if(creep.withdraw(tombe, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(tombe);
                    }
                }
                
                
            if (container == undefined) {
                container = creep.room.storage;
            }

            // if one was found
            if (container != undefined) {
                // try to withdraw energy, if the container is not in range
                if (creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    // move towards it
                    creep.moveTo(container, {reusePath: 50});
                }
            }

            let droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            if(droppedEnergy) {
                //console.log('lorry dropped energy   ' + droppedEnergy)
                if(creep.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                    //console.log('lorry move to energy   ' + droppedEnergy)
                    creep.moveTo(droppedEnergy);
                }
            }

            
            
        }
    }
};