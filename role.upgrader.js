
// role.upgrader


module.exports = {
    // a function to run the logic for this role
    /** @param {Creep} creep */
    run: function(creep) {
        // if creep is bringing energy to the controller but has no energy left
        if (creep.memory.working == true && creep.carry.energy <= 3) {
            // switch state
            creep.memory.working = false;
        }
        // if creep is harvesting energy but is full
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            // switch state
            creep.memory.working = true;
        }

        let miners = _.filter(Game.creeps, (creep) => creep.memory.role == 'miner');
        let nbSources = Game.spawns['Spawn1'].room.find(FIND_SOURCES).length;
        //console.log('nbSources in upgrader  ' + nbSources);
        
        // if creep is supposed to transfer energy to the controller
        if (creep.memory.working == true) {
            // instead of upgraderController we could also use:
            // if (creep.transfer(creep.room.controller, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {

            // try to upgrade the controller
            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                // if not in range, move towards the controller
                creep.moveTo(creep.room.controller, {reusePath: 15});
            }
        }
        // if creep is supposed to get energy
        //else if (miners.length >= nbSources) {
        else if (creep.memory.working == false) {
            //console.log('upgrader get nrj')
            creep.getEnergy(true, false);
        }
    }
};