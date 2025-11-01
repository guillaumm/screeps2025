
	
// prototype.tower
	
// create a new function for StructureTower
StructureTower.prototype.defend =
    function () {
        // find closes hostile creep
        let target = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        
        // if one is found...
        if (target != undefined) {
            // ...FIRE!
            this.attack(target);
        }
        else {
            //console.log('damagedStructure');
            let nbSources = Game.spawns['Spawn1'].room.find(FIND_SOURCES).length;
            let miners = _.filter(Game.creeps, (creep) => creep.memory.role == 'miner');
            
            //console.log('nbsources' + nbSources);
            if (miners.length >= nbSources) {
                let damagedStructure = this.pos.findClosestByPath(FIND_STRUCTURES, {
                //let damagedStructure = this.pos.find(FIND_STRUCTURES, {
                    filter: (s) => s.hits < s.hitsMax //&& s.structureType != STRUCTURE_CONTAINER
                    //filter: (s) => s.hits < s.hitsMax && s.structureType == STRUCTURE_CONTAINER
                    //filter: (s) => s.hits < 35000 //&& s.structureType == STRUCTURE_CONTAINER
                });
                
                //console.log(damagedStructure);
                
                if (damagedStructure != undefined) {
                //console.log(damagedStructure);
                this.repair(damagedStructure);
                }
            }
        }
    };
	
	