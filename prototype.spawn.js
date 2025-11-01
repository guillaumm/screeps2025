
// prototype.spawn
	
	
	//var listOfRoles = ['harvester', 'lorry', 'upgrader', 'repairer', 'builder', 'wallRepairer'];
	var listOfRoles = ['harvester','longDistanceHarvester', 'upgrader', 'lorry', 'builder', 'miner'];

// create a new function for StructureSpawn
StructureSpawn.prototype.spawnCreepsIfNecessary =
    function () {
        /** @type {Room} */
        let room = this.room;
        // find all creeps in room
        /** @type {Array.<Creep>} */
        let creepsInRoom = room.find(FIND_MY_CREEPS);
        
        // count the number of creeps alive for each role in this room
        // _.sum will count the number of properties in Game.creeps filtered by the
        //  arrow function, which checks for the creep being a specific role
        /** @type {Object.<string, number>} */
        let numberOfCreeps = {};
        for (let role of listOfRoles) {
            numberOfCreeps[role] = _.sum(creepsInRoom, (c) => c.memory.role == role);
			//console.log(role + numberOfCreeps[role]);
	
        }
        let maxEnergy = room.energyCapacityAvailable;
        //console.log(maxEnergy)
        let name = undefined;
        
        // if no harvesters are left AND either no miners or no lorries are left
        //  create a backup creep
        if (numberOfCreeps['harvester'] == 0 && numberOfCreeps['lorry'] == 0) {
            // if there are still miners or enough energy in Storage left
            if (numberOfCreeps['miner'] > 0 ||
                (room.storage != undefined && room.storage.store[RESOURCE_ENERGY] >= 150 + 550)) {
                // create a lorry
                name = this.createLorry(150);
            }
            // if there is no miner and not enough energy in Storage left
            else {
                // create a harvester because it can work on its own
                name = this.createCustomCreep(room.energyAvailable, 'harvester');
            }
        }
        // if no backup creep is required
        else {
            // check if all sources have miners
            
            let sources = room.find(FIND_SOURCES);
            // iterate over all sources
            for (let source of sources) {
                // if the source has no miner
                //console.log(source.id)
                if (!_.some(creepsInRoom, c => c.memory.role == 'miner' && c.memory.sourceId == source.id)) {
                    // check whether or not the source has a container
                    /** @type {Array.StructureContainer} */
                    let containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
                        filter: s => s.structureType == STRUCTURE_CONTAINER
                    });
                    // if there is a container next to the source
                    if (containers.length > 0) {
                        // spawn a miner
                        //console.log('miner spawning - source with container' + source);
                        let linkList = _.filter(Game.structures, s => s.structureType == STRUCTURE_LINK);
                        //console.log('miner spawning - linkList' + linkList);
                        let linkId
                        for (let link of linkList) {
                            //console.log('miner spawning - link' + link);
                            //console.log('miner spawning - link.pos.inRangeTo(source, 2)' + link.pos.inRangeTo(source, 2));
                            if(link.pos.inRangeTo(source, 2)) {
                                linkId=link.id;
                                //console.log('miner spawning - linkId' + linkId);
                            }
                        
                        
                        }
                        name = this.createMiner(source.id,linkId);
                        break;
                    }
                }
            }
        }

        // if none of the above caused a spawn command check for other roles
        if (name == undefined) {
            for (let role of listOfRoles) {
                //console.log('check   ' + role)
                //console.log('1      ' + this.memory.hasOwnProperty(this.memory.minCreeps))
                //console.log('1      ' + JSON.stringify(this.memory.hasOwnProperty))
                //console.log('2      ' + this.memory.hasOwnProperty(this.memory.minCreeps[role]))
                //console.log('3      ' + numberOfCreeps[role] < this.memory.minCreeps[role])
                
                
                
                
                
                if (this.memory.hasOwnProperty(this.memory.minCreeps) && this.memory.hasOwnProperty(this.memory.minCreeps[role])
                         && numberOfCreeps[role] < this.memory.minCreeps[role]) {
                    //console.log('grd if ok')
                    if (role == 'lorry') {
                        name = this.createLorry(150);
                    }
                    else {
                        name = this.createCustomCreep(maxEnergy, role);
                    }
                    break;
                }
            }
        }
        
        // print name to console if spawning was a success
        if (name != undefined && _.isString(name)) {
            console.log(this.name + " spawned new creep: " + name + " (" + Game.creeps[name].memory.role + ")");
            for (let role of listOfRoles) {
                //console.log(role + ": " + numberOfCreeps[role]);
            }
        }
    };

// create a new function for StructureSpawn
StructureSpawn.prototype.createCustomCreep =
    function (energy, roleName) {
        // create a balanced body as big as possible with the given energy
        //var numberOfParts = Math.floor(energy / 200);
        var numberOfParts = 1;
        // make sure the creep is not too big (more than 50 parts)
        numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3));
        var body = [];
        for (let i = 0; i < numberOfParts; i++) {
            body.push(WORK);
        }
        for (let i = 0; i < numberOfParts; i++) {
            body.push(CARRY);
        }
        for (let i = 0; i < numberOfParts; i++) {
            body.push(MOVE);
        }

        // create creep with the created body and the given role
        return this.spawnCreep(body, roleName + '_' + Game.time, { memory: { role: roleName, working: false }});
    };



// create a new function for StructureSpawn
StructureSpawn.prototype.createMiner =
    function (sourceId,linkId) {
        //return this.spawnCreep([CLAIM, MOVE], 'claimer_' + Game.time, {memory: { role: 'claimer', target: target }});
        //return this.spawnCreep([WORK, WORK, WORK, WORK, WORK, MOVE], 'miner_' + Game.time,
        return this.spawnCreep([WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE], 'miner_' + Game.time,
                                {memory: { role: 'miner', sourceId: sourceId, linkId:linkId }});
    };

// create a new function for StructureSpawn
StructureSpawn.prototype.createLorry =
    function (energy) {
        // create a body with twice as many CARRY as MOVE parts
        //var numberOfParts = Math.floor(energy / 150);
        var numberOfParts = 2;
        // make sure the creep is not too big (more than 50 parts)
        numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3));
        var body = [];
        for (let i = 0; i < numberOfParts; i++) {
            body.push(CARRY);
        }
        for (let i = 0; i < numberOfParts; i++) {
            body.push(MOVE);
        }

        // create creep with the created body and the role 'lorry'
        return this.spawnCreep(body, 'lorry_' + Game.time, {memory: { role: 'lorry', working: false }});
    };
	
	
	