/*
Module de gestion des Miners
Gère l'assignation des miners aux sources et la détection des containers/links
*/

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
                // Chercher un container près de la source
                let containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
                    filter: s => s.structureType == STRUCTURE_CONTAINER
                });
                
                // Chercher un link près de la source
                let links = source.pos.findInRange(FIND_STRUCTURES, 2, {
                    filter: s => s.structureType == STRUCTURE_LINK
                });
                
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
     * Crée le corps d'un miner selon l'énergie disponible
     * @param {number} energy - Énergie disponible
     * @param {number} multiplier - Multiplicateur de taille (depuis config)
     * @returns {Array} Le corps du miner
     */
    createMinerBody: function(energy, multiplier = 1.0) {
        // Corps basique d'un miner : [WORK x5, CARRY, MOVE x2]
        // Coût : 550 energy
        // Le CARRY permet de transférer vers un link
        // Les 2 MOVE permettent de se déplacer même chargé
        
        if (energy < 550) {
            // Corps minimal : [WORK x3, CARRY, MOVE]
            return [WORK, WORK, WORK, CARRY, MOVE];
        }
        
        // Calculer le nombre de WORK parts
        // Formule : 5 WORK + 1 CARRY + 2 MOVE = 550 energy
        // Pour chaque WORK supplémentaire : +100 energy
        
        let workParts = 5;
        let remainingEnergy = energy - 550;
        
        // Ajouter des WORK parts avec l'énergie restante
        let additionalWork = Math.floor(remainingEnergy / 100);
        workParts += Math.floor(additionalWork * multiplier);
        
        // Limiter à 20 WORK parts max (suffisant pour miner n'importe quelle source)
        // Au-delà, c'est du gaspillage car source.energy max = 3000
        workParts = Math.min(workParts, 20);
        
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
        
        let report = '\n  📍 ASSIGNATION DES MINERS:\n';
        
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
            let containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
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