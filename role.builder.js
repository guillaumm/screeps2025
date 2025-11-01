// role.builder - Version refactorisée
var roleUpgrader = require('role.upgrader');

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
            return;
        }

        // Gestion des états working/not working
        if (creep.memory.working == true && creep.carry.energy == 0) {
            creep.memory.working = false;
        }
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
        }

        // Si le creep doit construire
        if (creep.memory.working == true) {
            // Chercher un site de construction
            let constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            
            // Si un site existe, construire
            if (constructionSite != undefined) {
                if (creep.build(constructionSite) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionSite);
                }
            }
            // Si pas de site de construction, upgrader le contrôleur
            else {
                roleUpgrader.run(creep);
            }
        }
        // Si le creep doit récupérer de l'énergie
        else {
            // Vérifier combien de miners existent
            let miners = _.filter(Game.creeps, (c) => c.memory.role == 'miner');
            let nbSources = creep.room.find(FIND_SOURCES).length;
            
            // Si on a assez de miners, ne pas récolter directement aux sources
            // (laisser les sources aux miners pour l'efficacité)
            if (miners.length >= nbSources) {
                creep.getEnergy(true, false);  // Containers/Storage uniquement
            }
            // Sinon (phase bootstrap/construction), récolter aux sources
            else {
                creep.getEnergy(true, true);  // Containers/Storage ET sources
            }
        }
    }
};