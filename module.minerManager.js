/*
Module de gestion des Miners - Version refactorée
Gère l'assignation des miners aux sources et la détection des containers/links
Utilise la configuration centralisée
*/

const CONFIG = require('config.orchestrator');

module.exports = {
    
    /**
     * Analyse les sources d'une room et détermine quels miners sont nécessaires
     * @param {Room} room - La room à analyser
     * @returns {Array} Liste des besoins en miners avec leurs assignations
     */
    analyzeMinerNeeds: function(room) {
        let sources = room.find(FIND_SOURCES);
        let existingMiners = _.filter(Game.creeps, c => c.memory.role == 'miner');
        
        let needs = [];
        
        for (let source of sources) {
            // Vérifier si cette source a déjà un miner (vivant ou spawning)
            let assignedMiner = _.find(existingMiners, m => m.memory.sourceId == source.id);
            
            // Vérifier aussi si un miner est en cours de spawn pour cette source
            let spawningMiner = false;
            for (let spawnName in Game.spawns) {
                let spawn = Game.spawns[spawnName];
                if (spawn.spawning) {
                    let spawningCreep = Game.creeps[spawn.spawning.name];
                    if (spawningCreep && spawningCreep.memory.role == 'miner' && spawningCreep.memory.sourceId == source.id) {
                        spawningMiner = true;
                        break;
                    }
                }
            }
            
            if (!assignedMiner && !spawningMiner) {
                // Chercher un container près de la source (utilise la config)
                let containers = source.pos.findInRange(FIND_STRUCTURES, 
                    CONFIG.MINER_CONFIG.maxContainerRange, {
                    filter: s => s.structureType == STRUCTURE_CONTAINER
                });
                
                // Chercher un link près de la source (si configuré)
                let links = [];
                if (CONFIG.MINER_CONFIG.useLinksIfAvailable) {
                    links = source.pos.findInRange(FIND_STRUCTURES, 
                        CONFIG.MINER_CONFIG.maxContainerRange, {
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
                    // Pas de container, on note le besoin mais sans créer le miner
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
    
    /**
     * Retourne le nombre de miners actuels dans une room
     * @param {Room} room - La room
     * @returns {number}
     */
    getMinerCount: function(room) {
        return _.filter(Game.creeps, c => c.memory.role == 'miner' && c.memory.sourceId && 
            Game.getObjectById(c.memory.sourceId) && Game.getObjectById(c.memory.sourceId).room.name == room.name
        ).length;
    },
    
    /**
     * Retourne le nombre de miners requis (= nombre de sources avec container)
     * @param {Room} room - La room
     * @returns {number}
     */
    getRequiredMinerCount: function(room) {
        let needs = this.analyzeMinerNeeds(room);
        return needs.filter(n => n.hasContainer).length;
    },
    
    /**
     * Retourne les informations d'assignation pour le prochain miner à créer
     * @param {Room} room - La room
     * @returns {Object|null} Les infos d'assignation ou null si aucun besoin
     */
    getNextMinerAssignment: function(room) {
        let needs = this.analyzeMinerNeeds(room);
        let available = needs.filter(n => n.hasContainer);
        
        if (available.length > 0) {
            return available[0];
        }
        
        return null;
    },
    
    /**
     * Crée le corps d'un miner selon l'énergie disponible (utilise la config)
     * @param {number} energy - Énergie disponible
     * @param {number} multiplier - Multiplicateur de taille (depuis config)
     * @returns {Array} Le corps du miner
     */
    createMinerBody: function(energy, multiplier = 1.0) {
        // Corps d'un miner : [WORK x N, CARRY, MOVE, MOVE]
        // Le CARRY permet de transférer vers un link
        // Les 2 MOVE permettent de se déplacer même chargé
        
        // Corps minimal : [WORK, WORK, WORK, CARRY, MOVE] = 350 energy
        if (energy < 350) {
            if (energy < 300) {
                return [WORK, CARRY, MOVE]; // 250 energy
            }
            return [WORK, WORK, CARRY, MOVE]; // 300 energy
        }
        
        // Calculer combien de WORK parts on peut mettre
        // Formule : WORK x N + CARRY (50) + MOVE (50) + MOVE (50) = energy
        // Donc : N * 100 + 150 = energy
        // N = (energy - 150) / 100
        
        let workParts = Math.floor((energy - 150) / 100);
        
        // Appliquer le multiplicateur
        workParts = Math.floor(workParts * multiplier);
        
        // Utiliser les limites depuis la config
        workParts = Math.max(
            CONFIG.MINER_CONFIG.minWorkParts, 
            Math.min(workParts, CONFIG.MINER_CONFIG.maxWorkParts)
        );
        
        // Vérifier que le coût total ne dépasse pas l'énergie disponible
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
    
    /**
     * Génère un rapport sur l'état des miners
     * @param {Room} room - La room
     * @returns {string} Le rapport formaté
     */
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
        }
        
        return report;
    },
    
    /**
     * Vérifie si on peut créer des miners (si tous les containers sont construits)
     * @param {Room} room - La room
     * @returns {boolean}
     */
    canSpawnMiners: function(room) {
        let sources = room.find(FIND_SOURCES);
        let containersCount = 0;
        
        for (let source of sources) {
            let containers = source.pos.findInRange(FIND_STRUCTURES, 
                CONFIG.MINER_CONFIG.maxContainerRange, {
                filter: s => s.structureType == STRUCTURE_CONTAINER
            });
            if (containers.length > 0) {
                containersCount++;
            }
        }
        
        // On peut spawner des miners si au moins 1 source a un container
        return containersCount > 0;
    },
    
    /**
     * Vérifie si tous les miners nécessaires sont présents
     * @param {Room} room - La room
     * @returns {boolean}
     */
    hasAllMiners: function(room) {
        return this.getMinerCount(room) >= this.getRequiredMinerCount(room);
    }
};