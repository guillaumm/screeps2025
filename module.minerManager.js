/*
Module de gestion des Miners - DISTANCE CORRIGÉE
🔧 Utilise CONFIG.CONTAINER_SOURCE_DISTANCE partout
*/

const CONFIG = require('config.orchestrator');

module.exports = {
    
    /**
     * Analyse les sources d'une room et détermine quels miners sont nécessaires
     */
    analyzeMinerNeeds: function(room) {
        let sources = room.find(FIND_SOURCES);
        // 🔧 FIX: Filtrer seulement les miners de CETTE room
        let existingMiners = _.filter(Game.creeps, c => 
            c.memory.role == 'miner' && 
            c.room.name == room.name
        );
        
        let needs = [];
        
        for (let source of sources) {
            // Vérifier si cette source a déjà un miner (vivant ou spawning)
            let assignedMiner = _.find(existingMiners, m => m.memory.sourceId == source.id);
            
            // Vérifier aussi spawning miners
            let spawningMiner = false;
            for (let spawnName in Game.spawns) {
                let spawn = Game.spawns[spawnName];
                if (spawn.spawning) {
                    let spawningCreep = Game.creeps[spawn.spawning.name];
                    if (spawningCreep && 
                        spawningCreep.memory.role == 'miner' && 
                        spawningCreep.memory.sourceId == source.id) {
                        spawningMiner = true;
                        break;
                    }
                }
            }
            
            if (!assignedMiner && !spawningMiner) {
                // 🔧 Utiliser la constante globale
                let containers = source.pos.findInRange(FIND_STRUCTURES, 
                    CONFIG.CONTAINER_SOURCE_DISTANCE, {
                    filter: s => s.structureType == STRUCTURE_CONTAINER
                });
                
                let links = [];
                if (CONFIG.MINER_CONFIG.useLinksIfAvailable) {
                    links = source.pos.findInRange(FIND_STRUCTURES, 
                        CONFIG.CONTAINER_SOURCE_DISTANCE, {
                        filter: s => s.structureType == STRUCTURE_LINK
                    });
                }
                
                // On ne crée un miner que s'il y a un container
                if (containers.length > 0) {
                    needs.push({
                        sourceId: source.id,
                        sourcePos: source.pos,
                        containerId: containers[0].id,
                        linkId: links.length > 0 ? links[0].id : null,
                        hasContainer: true
                    });
                } else {
                    needs.push({
                        sourceId: source.id,
                        sourcePos: source.pos,
                        containerId: null,
                        linkId: null,
                        hasContainer: false
                    });
                }
            }
        }
        
        return needs;
    },
    
    getMinerCount: function(room) {
        return _.filter(Game.creeps, c => 
            c.memory.role == 'miner' && 
            c.memory.sourceId && 
            Game.getObjectById(c.memory.sourceId) && 
            Game.getObjectById(c.memory.sourceId).room.name == room.name
        ).length;
    },
    
    getRequiredMinerCount: function(room) {
        let needs = this.analyzeMinerNeeds(room);
        return needs.filter(n => n.hasContainer).length;
    },
    
    getNextMinerAssignment: function(room) {
        let needs = this.analyzeMinerNeeds(room);
        let available = needs.filter(n => n.hasContainer);
        
        if (available.length > 0) {
            return available[0];
        }
        
        return null;
    },
    
    createMinerBody: function(energy, multiplier = 1.0) {
        // Corps minimal: [WORK, WORK, WORK, CARRY, MOVE] = 350 energy
        if (energy < 350) {
            if (energy < 300) {
                return [WORK, CARRY, MOVE]; // 250 energy
            }
            return [WORK, WORK, CARRY, MOVE]; // 300 energy
        }
        
        // Calculer WORK parts: N * 100 + 150 = energy
        let workParts = Math.floor((energy - 150) / 100);
        workParts = Math.floor(workParts * multiplier);
        
        // Limites
        workParts = Math.max(
            CONFIG.MINER_CONFIG.minWorkParts, 
            Math.min(workParts, CONFIG.MINER_CONFIG.maxWorkParts)
        );
        
        // Vérifier coût total
        let totalCost = workParts * 100 + 150;
        if (totalCost > energy) {
            workParts = Math.floor((energy - 150) / 100);
        }
        
        // Construire le corps
        let body = [];
        for (let i = 0; i < workParts; i++) {
            body.push(WORK);
        }
        body.push(CARRY, MOVE, MOVE);
        
        return body;
    },
    
    generateMinerReport: function(room) {
        let sources = room.find(FIND_SOURCES);
        let miners = _.filter(Game.creeps, c => c.memory.role == 'miner' && c.room.name == room.name);
        let needs = this.analyzeMinerNeeds(room);
        
        let report = '\n  🔍 ASSIGNATION DES MINERS:\n';
        
        for (let i = 0; i < sources.length; i++) {
            let source = sources[i];
            let assignedMiner = _.find(miners, m => m.memory.sourceId == source.id);
            let need = needs.find(n => n.sourceId == source.id);
            
            let status = '❌ Pas de container';
            if (need && need.hasContainer) {
                status = assignedMiner ? `✅ ${assignedMiner.name}` : '⚠️  Besoin d\'un miner';
            }
            
            report += `    Source ${i + 1}: ${status}\n`;
            
            if (need && need.linkId) {
                report += `      └─ Link disponible\n`;
            }
            
            // 🔧 DEBUG: Afficher la distance des containers trouvés
            if (need && !need.hasContainer) {
                let nearbyContainers = source.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: s => s.structureType == STRUCTURE_CONTAINER
                });
                if (nearbyContainers.length > 0) {
                    let dist = source.pos.getRangeTo(nearbyContainers[0]);
                    report += `      └─ ⚠️  Container trouvé mais à distance ${dist} (max: ${CONFIG.CONTAINER_SOURCE_DISTANCE})\n`;
                }
            }
        }
        
        return report;
    },
    
    canSpawnMiners: function(room) {
        let sources = room.find(FIND_SOURCES);
        let containersCount = 0;
        
        for (let source of sources) {
            // 🔧 Utiliser la constante globale
            let containers = source.pos.findInRange(FIND_STRUCTURES, 
                CONFIG.CONTAINER_SOURCE_DISTANCE, {
                filter: s => s.structureType == STRUCTURE_CONTAINER
            });
            if (containers.length > 0) {
                containersCount++;
            }
        }
        
        return containersCount > 0;
    },
    
    hasAllMiners: function(room) {
        return this.getMinerCount(room) >= this.getRequiredMinerCount(room);
    }
};