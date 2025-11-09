// role.upgrader - Version refactorée avec configuration centralisée

const CONFIG = require('config.orchestrator');

module.exports = {
    /** @param {Creep} creep */
    run: function(creep) {
        
        // Gestion des états
        if (creep.memory.working == true && creep.carry.energy <= 3) {
            creep.memory.working = false;
        }
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
        }

        // Si le creep doit upgrader le controller
        if (creep.memory.working == true) {
            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {reusePath: 15});
            }
        }
        // Si le creep doit récupérer de l'énergie
        else if (creep.memory.working == false) {
            // Utiliser la configuration pour déterminer si on récolte aux sources
            let useSource = CONFIG.shouldUseSourcesDirectly(creep, creep.room);
            creep.getEnergy(true, useSource);
        }
    }
};