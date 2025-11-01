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
        else if (creep.memory.working == false && (creep.carry.energy == creep.store.getCapacity() || creep.ticksToLive<30 )) {
            // switch state
            creep.memory.working = true;
        }
        
        //var targetPos = new RoomPosition(44, 34, 'E12S11'); 
        //console.log('avant 25 25')
        //creep.moveTo(targetPos);


        // if creep is supposed to transfer energy to a structure
        if (creep.memory.working == true) {
            // if in home room
            if (creep.room.name == creep.memory.home) {
                // find closest spawn, extension or tower which is not full
                var structure = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    // the second argument for findClosestByPath is an object which takes
                    // a property called filter which can be a function
                    // we use the arrow operator to define it
                    filter: (s) => (s.structureType == STRUCTURE_SPAWN
                                 || s.structureType == STRUCTURE_EXTENSION
                                 || s.structureType == STRUCTURE_LINK
                                 || s.structureType == STRUCTURE_TOWER)
                                 && s.energy < s.energyCapacity
                });

                if (structure == undefined) {
                    structure = creep.room.storage;
                }

                // if we found one
                if (structure != undefined) {
                    // try to transfer energy, if it is not in range
                    if (creep.transfer(structure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        // move towards it
                        creep.moveTo(structure);
                    }
                }
                

            }
            // if not in home room...
            else {
                // find exit to home room
                var exit = creep.room.findExitTo(creep.memory.home);
                // and move to exit
                creep.moveTo(creep.pos.findClosestByRange(exit));
                

            }
        }
        // if creep is supposed to harvest energy from source
        else {
            // if in target room
            if (creep.room.name == creep.memory.target) {
                
                let droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if(droppedEnergy) {
                   //console.log('lorry dropped energy   ' + droppedEnergy)
                  if(creep.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                      //console.log('lorry move to energy   ' + droppedEnergy)
                      creep.moveTo(droppedEnergy);
                  }
            }
                
                // attaque des creeps hostiles
                var creepcible = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                // if one is found...
                if (creepcible != undefined) {
                    // ...FIRE!
                    if (creep.attack(creepcible) == ERR_NOT_IN_RANGE) {
                        // move towards it
                        creep.moveTo(creepcible);
                    }
                }
                
                // attaque des structures
                var structcible = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    // the second argument for findClosestByPath is an object which takes
                    // a property called filter which can be a function
                    // we use the arrow operator to define it
                    filter: (s) => (s.structureType == STRUCTURE_EXTENSION
                                 || s.structureType == STRUCTURE_RAMPART)
                });
                // if one is found...
                if (structcible != undefined) {
                    // ...FIRE!
                    if (creep.attack(structcible) == ERR_NOT_IN_RANGE) {
                        // move towards it
                        creep.moveTo(structcible);
                    }
                }
                
                
                // find source
                //var source = creep.room.find(FIND_SOURCES)[creep.memory.sourceIndex];
                var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                // try to harvest energy, if the source is not in range
                if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    
                    //console.log(source)
                    // move towards the source
                    creep.moveTo(source);
                }
            }
            // if not in target room
            else {
                // find exit to target room
                var exit = creep.room.findExitTo(creep.memory.target);
                // move to exit
                creep.moveTo(creep.pos.findClosestByRange(exit));
            }
        }
    }
};