// role.repairer - Rôle dédié aux réparations
const RepairManager = require('module.repairManager');
var roleUpgrader = require('role.upgrader');

module.exports = {
    /** @param {Creep} creep */
    run: function(creep) {
        
        // Gestion des états working/not working
        if (creep.memory.working == true && creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.memory.repairTarget = null;
        }
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
        }

        // Si le creep doit réparer
        if (creep.memory.working == true) {
            // Si on a déjà une cible de réparation en mémoire, la vérifier
            let repairTarget = null;
            if (creep.memory.repairTarget) {
                repairTarget = Game.getObjectById(creep.memory.repairTarget);
                // Vérifier si la cible est toujours valide
                if (repairTarget && repairTarget.hits >= repairTarget.hitsMax) {
                    repairTarget = null;
                    creep.memory.repairTarget = null;
                }
            }
            
            // Si pas de cible valide, en trouver une nouvelle
            if (!repairTarget) {
                repairTarget = RepairManager.findRepairTarget(creep.room, creep);
                if (repairTarget) {
                    creep.memory.repairTarget = repairTarget.id;
                }
            }
            
            if (repairTarget) {
                // Réparer
                if (creep.repair(repairTarget) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(repairTarget);
                }
            } else {
                // Si rien à réparer, regarder les walls/ramparts
                let wallTarget = RepairManager.findWallToRepair(creep.room, 50000);
                
                if (wallTarget) {
                    if (creep.repair(wallTarget) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(wallTarget);
                    }
                } else {
                    // Si vraiment rien à faire, aider à upgrader
                    roleUpgrader.run(creep);
                }
            }
        }
        // Si le creep doit récupérer de l'énergie
        else {
            // Vérifier combien de miners existent
            let miners = _.filter(Game.creeps, (c) => c.memory.role == 'miner');
            let nbSources = creep.room.find(FIND_SOURCES).length;
            
            // Si on a assez de miners, ne pas récolter directement aux sources
            if (miners.length >= nbSources) {
                creep.getEnergy(true, false);  // Containers/Storage uniquement
            }
            // Sinon, récolter aux sources
            else {
                creep.getEnergy(true, true);  // Containers/Storage ET sources
            }
        }
    }
};