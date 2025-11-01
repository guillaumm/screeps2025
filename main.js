
/*

to do


remplir les extensions quand les miners vont mourir
centraliser dans la mémoire les états globaux (mode de fonctionnement)

*/

// main avec harvester
// import modules
require('prototype.creep');
require('prototype.tower');
require('prototype.spawn');
require('prototype.link');

module.exports.loop = function() {
    
    //console.log(Game.cpu.bucket)
    if(Game.cpu.bucket > 9000) {
    Game.cpu.generatePixel();
    }
    if(!Memory.niveaux) {
        let niveaux = new Array();
        Memory.niveaux = niveaux; //On l'initialise à 0.
    }
    
    if (Game.time%20 == 0) {
        //console.log(JSON.stringify(Game.time));
        const storages = Game.spawns['Spawn1'].room.find(FIND_STRUCTURES, {
            filter: s => (
                    s.structureType == STRUCTURE_CONTAINER ||
                    s.structureType == STRUCTURE_LINK
                    || s.structureType == STRUCTURE_STORAGE)
        });
        let tick_niveaux = ";" + String(Game.time) + " " + Game.spawns['Spawn1'].room.controller.progress + " ";
        //console.log(tick_niveaux);
        for (let i in storages) {
            tick_niveaux = tick_niveaux + " " + storages[i].structureType + i + " " + storages[i].store.energy
            //console.log(niv)
            
        };
        console.log("tick_niveaux " + tick_niveaux);
        //Memory.niveaux.push(tick_niveaux)
        Memory.niveaux[0]+=tick_niveaux;
        
    }
    
    //console.log(Game.spawns['Spawn1'].room.controller.progress)
    
    /*On accède à la mémoire, qui change
    if(Memory.x < 80) {
        //console.log(Memory.x);
        Memory.x +=1; // Ajoute 1 à Memory.x
        
        
    }
    else
    {
        //Sera exécuté après 50 ticks
        //console.log("Genial, x vaut plus de 50!");
    }*/
    
    
    
    // check for memory entries of died creeps by iterating over Memory.creeps
    for (let name in Memory.creeps) {
        // and checking if the creep is still alive
        if (Game.creeps[name] == undefined) {
            // if not, delete the memory entry
            delete Memory.creeps[name];
        }
    };
    
    

    // for each creeps
    for (let name in Game.creeps) {
        //console.log(name)
        // run creep logic
        Game.creeps[name].runRole();
    };

    // find all towers
    var towers = _.filter(Game.structures, s => s.structureType == STRUCTURE_TOWER);
    // for each tower
    for (let tower of towers) {
        // run tower logic
        tower.defend();
    };
    
    // find all links
    //const sourceList = Game.spawns['Spawn1'].room.find(FIND_SOURCES);
    //console.log('sourceList   '+ sourceList)
    let linkList = _.filter(Game.structures, s => s.structureType == STRUCTURE_LINK);
    //console.log('linkList   '+ linkList)
    let linkTo = linkList[0];
    if (linkList[1].store.getFreeCapacity(RESOURCE_ENERGY)>linkList[0].store.getFreeCapacity(RESOURCE_ENERGY)) {
        linkTo = linkList[1];
    }
    
    linkList[2].transferEnergy(linkTo); //control

    // for each link
    /*for (let link of linksFrom) {
        // run tower logic
        link.envoie(linkTo);
    }*/

    // for each spawn
    for (let spawnName in Game.spawns) {
        // run spawn logic
        Game.spawns[spawnName].spawnCreepsIfNecessary();
    }



    //console.log(JSON.stringify(Game.spawns['Spawn1'].room))
    //console.log(JSON.stringify(Game.rooms))
    //'E32S13'

    const nbUpgr = 4;
    const harvesterBase = 1;
    const nbLongDistanceHarvester = 2;
    const nbBuild = 1;
    const nbRepair = 0;
    const nbRoadRepair = 0;
    const lorryFactor = 1;
    


	let upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
	let harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
	//let longdistanceharvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'longDistanceHarvester');
	let numberOfLongDistanceHarvesters = _.sum(Game.creeps, (c) => c.memory.role == 'longDistanceHarvester' && c.memory.target == 'E12S12')
	let builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
	let repairers = _.filter(Game.creeps, (creep) => creep.memory.role == 'repairer');
	let roadRepairers = _.filter(Game.creeps, (creep) => creep.memory.role == 'roadRepairer');
	let miners = _.filter(Game.creeps, (creep) => creep.memory.role == 'miner');
    let lorries = _.filter(Game.creeps, (creep) => creep.memory.role == 'lorry');
	
    let nbLorry = lorryFactor * miners.length;
    //console.log(nbLorry);
    let nbHarv = harvesterBase - miners.length;
    
    let nbSources = Game.spawns['Spawn1'].room.find(FIND_SOURCES).length;

	if(harvesters.length < nbHarv) {
        let newName = 'Harvester' + Game.time;
        console.log('Spawning new Harvester: ' + newName);
        Game.spawns['Spawn1'].spawnCreep([WORK,CARRY,MOVE], newName, 
            {memory: {role: 'harvester', working: false}});        
    }

    //console.log('miner length ' + miners.length)
    
        
    let upgradeBody;
    
    if (miners.length >= nbSources) {
    	if(upgraders.length < nbUpgr) {
            let newName = 'UPG' + Game.time;
            console.log('Spawning new upgrader: ' + newName);
            /*if (linkList.length >= 2){
                upgradeBody = [MOVE,WORK,CARRY];
                }
            if (linkList.length < 2){*/
                //upgradeBody = [MOVE,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY];
                upgradeBody = [MOVE,WORK,CARRY,MOVE,WORK,CARRY, MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY];
                //}
            Game.spawns['Spawn1'].spawnCreep(upgradeBody, newName,{memory: {role: 'upgrader', working: false}}, {directions: [BOTTOM_LEFT]});

        }
    
        else if(lorries.length < nbLorry) {
            let newName = 'Break' + Game.time;
            console.log('Spawning new lorry: ' + newName);
            Game.spawns['Spawn1'].spawnCreep([CARRY,MOVE,CARRY], newName,{memory: {role: 'lorry', working: false}});     
        }
    
        else if(builders.length < nbBuild) {
            let newName = 'Ouvrier' + Game.time;
            console.log('Spawning new builder: ' + newName);
            //Game.spawns['Spawn1'].spawnCreep([WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY, MOVE], newName, 
            Game.spawns['Spawn1'].spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY], newName, 
                {memory: {role: 'builder', working: false}});        
        }
    
        else if(numberOfLongDistanceHarvesters < nbLongDistanceHarvester) {
            let newName = 'LHD' + Game.time;
            console.log('Spawning new LDH: ' + newName);
            //Game.spawns['Spawn1'].spawnCreep([TOUGH,TOUGH,TOUGH,CARRY,MOVE,ATTACK,ATTACK,ATTACK], newName, {memory: {role: 'longDistanceHarvester',home: 'W2S36',target: 'W2S35',sourceIndex: 1,working: false}});
            Game.spawns['Spawn1'].spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,ATTACK], newName, {memory: {role: 'longDistanceHarvester',home: 'E13S12',target: 'E12S12',sourceIndex: 0,working: false}});
            //Game.spawns['Spawn1'].spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,ATTACK,ATTACK], newName, {memory: {role: 'longDistanceHarvester',home: 'E13S12',target: 'E12S12',sourceIndex: 0,working: false}});
            //Game.spawns['Spawn1'].spawnCreep([TOUGH,TOUGH,TOUGH,WORK,MOVE,CARRY,MOVE,WORK,CARRY,MOVE,MOVE,ATTACK,ATTACK], newName, {memory: {role: 'longDistanceHarvester',home: 'E13S12',target: 'E12S12',sourceIndex: 0,working: false}});
                    
        }
    }




};