// prototype.tower
	
// create a new function for StructureTower
StructureTower.prototype.defend =
    function () {
        // find closest hostile creep
        let target = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        
        // if one is found...
        if (target != undefined) {
            // ...FIRE!
            this.attack(target);
        }
        else {
            // Récupérer le nombre de sources dans la room de la tour
            let nbSources = this.room.find(FIND_SOURCES).length;
            let miners = _.filter(Game.creeps, (creep) => creep.memory.role == 'miner');
            
            // Seulement réparer si on a assez de miners (économie d'énergie)
            if (miners.length >= nbSources) {
                let damagedStructure = this.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => s.hits < s.hitsMax
                });
                
                if (damagedStructure != undefined) {
                    this.repair(damagedStructure);
                }
            }
        }
    };