// prototype.creep

var roles = {
    harvester: require('role.harvester'),
    upgrader: require('role.upgrader'),
    builder: require('role.builder'),
    repairer: require('role.repairer'),
    longDistanceHarvester: require('role.longDistanceHarvester'),
    miner: require('role.miner'),
    lorry: require('role.lorry')
};

Creep.prototype.runRole =
    function () {
        roles[this.memory.role].run(this);
    };

/** @function 
    @param {bool} useContainer
    @param {bool} useSource */
Creep.prototype.getEnergy =
    function (useContainer, useSource) {
        /** @type {StructureContainer} */
        let container;
        // if the Creep should look for containers
        if (useContainer) {
            
            let linkList = _.filter(Game.structures, s => s.structureType == STRUCTURE_LINK);
            let linkTo = linkList[1];
            
            if (this.memory.role=='upgrader') {
                if(this.withdraw(linkTo) == ERR_NOT_IN_RANGE) {
                    this.moveTo(linkTo);
                }
            }

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
    };