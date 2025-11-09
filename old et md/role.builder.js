// role.builder - Version refactorisée avec priorisation des containers sources

var roleUpgrader = require('role.upgrader');
const RepairManager = require('module.repairManager');
const ConstructionManager = require('module.constructionManager');
const CONFIG = require('config.orchestrator');

module.exports = {
    /** @param {Creep} creep */
    run: function(creep) {
        
        // Si target room définie et pas dans cette room
        if (creep.memory.target != undefined && creep.room.name != creep.memory.target) {
            var exit = creep.room.findExitTo(creep.memory.target);
            creep.moveTo(creep.pos.findClosestByRange(exit));
            return;
        }

        // Gestion des états working/not working
        if (creep.memory.working == true && creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.memory.constructionTarget = null;
            creep.memory.repairTarget = null;
        }
        else if (creep.memory.working == false && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
        }

        // Si le creep doit travailler
        if (creep.memory.working == true) {
            
            // 1. PRIORITÉ ABSOLUE : Construire les sites prioritaires (containers sources)
            let constructionTarget = null;
            
            // Vérifier/récupérer la cible de construction en mémoire
            if (creep.memory.constructionTarget) {
                constructionTarget = Game.getObjectById(creep.memory.constructionTarget);
                // Vérifier si toujours valide
                if (!constructionTarget || constructionTarget.progress >= constructionTarget.progressTotal) {
                    constructionTarget = null;
                    creep.memory.constructionTarget = null;
                }
            }
            
            // Si pas de cible valide, en trouver une nouvelle avec priorisation
            if (!constructionTarget) {
                constructionTarget = ConstructionManager.findPriorityConstructionSite(creep.room, creep);
                if (constructionTarget) {
                    creep.memory.constructionTarget = constructionTarget.id;
                }
            }
            
            if (constructionTarget) {
                // Construire
                if (creep.build(constructionTarget) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionTarget);
                }
            } 
            // 2. Pas de construction : vérifier si les builders doivent réparer
            else if (CONFIG.REPAIR_CONFIG.buildersAutoRepair) {
                
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
                    // 3. Pas de réparation non plus, upgrader
                    roleUpgrader.run(creep);
                }
            } 
            else {
                // Si builders n'auto-réparent pas, upgrader directement
                roleUpgrader.run(creep);
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