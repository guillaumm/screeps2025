

// prototype.creep

var roles = {
    harvester: require('role.harvester'),
    upgrader: require('role.upgrader'),
    builder: require('role.builder'),
    //repairer: require('role.repairer'),
    //wallRepairer: require('role.wallRepairer'),
    longDistanceHarvester: require('role.longDistanceHarvester'),
    //roadRepairer: require('role.roadRepairer'),
    miner: require('role.miner'),
    lorry: require('role.lorry')
};

Creep.prototype.runRole =
    function () {
        //console.log(this.memory.role)
        roles[this.memory.role].run(this);
        
    };

/** @function 
    @param {bool} useContainer
    @param {bool} useSource */
Creep.prototype.getEnergy =
    function (useContainer, useSource) {
        /** @type {StructureContainer} */
        ///*1
        let container;
        // if the Creep should look for containers
        if (useContainer) {

            
                
                let linkList = _.filter(Game.structures, s => s.structureType == STRUCTURE_LINK);
                //console.log('linkList in creep   '+ linkList)
                let linkTo = linkList[1];
                //console.log('linkTo in creep  '+ linkTo)
                //if (linkTo.store.getUsedCapacity(RESOURCE_ENERGY)>0 && this.memory.role=='upgrader') {
                if (this.memory.role=='upgrader'
                    //&& linkTo.store.getUsedCapacity(RESOURCE_ENERGY)>0
                    ){
                    //console.log('in creep get ernergy upgrader ' + linkTo + 'creep ' + this.memory.role + ' ' + this.name)
                    if(this.withdraw(linkTo) == ERR_NOT_IN_RANGE) {
                    this.moveTo(linkTo);
                    }
                }
                
                /*let tombe = this.pos.findClosestByRange(FIND_TOMBSTONES);
                if(tombe) {
                    console.log('tombe ' + tombe)
                    if(this.withdraw(tombe, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    this.moveTo(tombe);
                    }
                }*/

                


            container = this.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (
                    s.structureType == STRUCTURE_CONTAINER ||
                    s.structureType == STRUCTURE_LINK
                    || s.structureType == STRUCTURE_STORAGE
                ) && s.store[RESOURCE_ENERGY] > 100
            });
            // if one was found
            if (container != undefined) {
                // try to withdraw energy, if the container is not in range
                if (this.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    // move towards it
                    this.moveTo(container, {reusePath: 50});
                }
            }
           
            
        }
        // if no container was found and the Creep should look for Sources
        if (container == undefined && useSource) {
            // find closest source
            var source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                let droppedEnergy = this.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if(droppedEnergy) {
                    if(this.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                    this.moveTo(droppedEnergy);
                    }
                }

            // try to harvest energy, if the source is not in range
            if (this.harvest(source) == ERR_NOT_IN_RANGE) {
                // move towards it
                this.moveTo(source, {reusePath: 50});
            }
        }
        
        //1*/
    };


	