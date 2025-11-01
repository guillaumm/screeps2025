	
	
// role.builder
	var roleUpgrader = require('role.upgrader');
	var roleHarvester = require('role.harvester');
	var roleLorry = require('role.lorry');

module.exports = {
    // a function to run the logic for this role
    /** @param {Creep} creep */
    run: function (creep) {
        // if target is defined and creep is not in target room
        if (creep.memory.target != undefined && creep.room.name != creep.memory.target) {
            // find exit to target room
            var exit = creep.room.findExitTo(creep.memory.target);
            // move to exit
            creep.moveTo(creep.pos.findClosestByRange(exit));
            // return the function to not do anything else
            return;
        }

        // if creep is trying to complete a constructionSite but has no energy left
        if (creep.memory.working == true && creep.carry.energy == 0) {
            // switch state
            creep.memory.working = false;
        }
        // if creep is harvesting energy but is full
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            // switch state
            creep.memory.working = true;
        }

        // if creep is supposed to complete a constructionSite
        let nbSources = Game.spawns['Spawn1'].room.find(FIND_SOURCES).length - 1;
        let miners = _.filter(Game.creeps, (creep) => creep.memory.role == 'miner');
        let constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        
        if (creep.memory.working == true && miners.length >= nbSources && constructionSite != undefined) {
        //if (creep.memory.working == true && constructionSite != undefined) {
                if (creep.build(constructionSite) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionSite);
                    //creep.moveTo(40,4);
                }
            }
        
        else if (creep.memory.working == true && miners.length < nbSources) {
        //else if (miners.length < nbSources) {
            roleHarvester.run(creep);
        }
        
        else if (creep.memory.working == true && miners.length >= nbSources && constructionSite == undefined) {
                //roleLorry.run(creep);
                //roleHarvester.run(creep);
                roleUpgrader.run(creep);
            }
        
        // if creep is supposed to get energy
        else {
            creep.getEnergy(true, false);
        }
    }
};

