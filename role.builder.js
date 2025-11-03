// role.builder - Version avec réparations automatiques
var roleUpgrader = require('role.upgrader');
const RepairManager = require('module.repairManager');

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
            creep.memory.repairTarget = null; // Reset repair target
        }
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
        }

        // Si le creep doit travailler
        if (creep.memory.working == true) {
            // 1. PRIORITÉ : Chercher un site de construction
            let constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            
            if (constructionSite != undefined) {
                // Construire
                if (creep.build(constructionSite) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionSite);
                }
            } else {
                // 2. Pas de construction, chercher des réparations
                
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
                    // 3. Pas de réparation non plus, upgrader le contrôleur
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