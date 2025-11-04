// role.repairer - Version refactorée avec configuration centralisée

const RepairManager = require('module.repairManager');
const CONFIG = require('config.orchestrator');
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
            
            // Vérifier/récupérer la cible de réparation en mémoire
            let repairTarget = null;
            if (creep.memory.repairTarget) {
                repairTarget = Game.getObjectById(creep.memory.repairTarget);
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
                let wallTarget = RepairManager.findWallToRepair(
                    creep.room, 
                    CONFIG.REPAIR_CONFIG.maxWallHits
                );
                
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
            // Utiliser la configuration pour déterminer si on récolte aux sources
            let useSource = CONFIG.shouldUseSourcesDirectly(creep, creep.room);
            creep.getEnergy(true, useSource);
        }
    }
};