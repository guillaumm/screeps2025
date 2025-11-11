/*
Module de placement automatique des containers sources
Place automatiquement les containers à distance 1 des sources
*/

const CONFIG = require('config.orchestrator');

module.exports = {
    
    /**
     * Place automatiquement tous les containers sources manquants
     * @param {Room} room - La room
     * @returns {number} Nombre de containers placés
     */
    placeAllMissingContainers: function(room) {
        let sources = room.find(FIND_SOURCES);
        let placed = 0;
        
        for (let source of sources) {
            if (this.needsContainer(source)) {
                let result = this.placeContainerForSource(source);
                if (result === OK) {
                    placed++;
                    console.log(`[AUTO-PLACER] ✅ Container placé pour source ${source.id}`);
                } else if (result !== ERR_INVALID_TARGET) {
                    // ERR_INVALID_TARGET = déjà un site de construction, c'est normal
                    console.log(`[AUTO-PLACER] ⚠️ Échec placement container: ${result}`);
                }
            }
        }
        
        return placed;
    },
    
    /**
     * Vérifie si une source a besoin d'un container
     * @param {Source} source - La source
     * @returns {boolean}
     */
    needsContainer: function(source) {
        // Vérifier si un container existe déjà à distance 1
        let existingContainers = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        if (existingContainers.length > 0) {
            return false; // Container déjà construit
        }
        
        // Vérifier si un site de construction existe déjà
        let existingSites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        if (existingSites.length > 0) {
            return false; // Construction déjà en cours
        }
        
        return true; // Besoin d'un container
    },
    
    /**
     * Place un container pour une source spécifique
     * @param {Source} source - La source
     * @returns {number} Code de retour (OK ou erreur)
     */
    placeContainerForSource: function(source) {
        let bestPos = this.findBestContainerPosition(source);
        
        if (!bestPos) {
            console.log(`[AUTO-PLACER] ❌ Aucune position valide trouvée pour source ${source.id}`);
            return ERR_INVALID_ARGS;
        }
        
        // Créer le site de construction
        let result = source.room.createConstructionSite(bestPos.x, bestPos.y, STRUCTURE_CONTAINER);
        
        if (result === OK) {
            console.log(`[AUTO-PLACER] 📍 Container placé en (${bestPos.x}, ${bestPos.y}) pour source en (${source.pos.x}, ${source.pos.y})`);
        }
        
        return result;
    },
    
    /**
     * Trouve la meilleure position pour un container près d'une source
     * CRITÈRE : Distance 1 de la source (le miner se placera dessus)
     * @param {Source} source - La source
     * @returns {RoomPosition|null}
     */
    findBestContainerPosition: function(source) {
        let room = source.room;
        let terrain = room.getTerrain();
        
        // Récupérer toutes les positions à distance 1 (les 8 cases autour)
        let candidates = [];
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue; // Pas sur la source elle-même
                
                let x = source.pos.x + dx;
                let y = source.pos.y + dy;
                
                // Vérifier que la position est dans la room
                if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                
                let pos = new RoomPosition(x, y, room.name);
                
                // Vérifier que c'est constructible
                if (this.isPositionValid(pos, terrain)) {
                    let score = this.scorePosition(pos, source);
                    candidates.push({ pos: pos, score: score });
                }
            }
        }
        
        if (candidates.length === 0) {
            return null;
        }
        
        // Trier par score (plus haut = meilleur)
        candidates.sort((a, b) => b.score - a.score);
        
        return candidates[0].pos;
    },
    
    /**
     * Vérifie si une position est valide pour un container
     * @param {RoomPosition} pos - La position
     * @param {Terrain} terrain - Le terrain de la room
     * @returns {boolean}
     */
    isPositionValid: function(pos, terrain) {
        // Vérifier le terrain (pas un mur)
        if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
            return false;
        }
        
        // Vérifier qu'il n'y a pas déjà une structure
        let structures = pos.lookFor(LOOK_STRUCTURES);
        if (structures.length > 0) {
            // Sauf les roads qui sont compatibles
            for (let struct of structures) {
                if (struct.structureType !== STRUCTURE_ROAD) {
                    return false;
                }
            }
        }
        
        // Vérifier qu'il n'y a pas déjà un site de construction
        let sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        if (sites.length > 0) {
            return false;
        }
        
        return true;
    },
    
    /**
     * Calcule un score pour une position (plus haut = meilleur)
     * @param {RoomPosition} pos - La position à évaluer
     * @param {Source} source - La source
     * @returns {number}
     */
    scorePosition: function(pos, source) {
        let score = 0;
        let room = source.room;
        
        // 1. PRIORITÉ : Proximité au spawn (le miner doit pouvoir y aller facilement)
        let spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            let pathToSpawn = pos.findPathTo(spawns[0]);
            if (pathToSpawn.length > 0) {
                // Plus le chemin est court, mieux c'est
                score += (100 - pathToSpawn.length);
            }
        }
        
        // 2. BONUS : Si proche du controller (pour upgraders qui viendront chercher de l'énergie)
        if (room.controller) {
            let distToController = pos.getRangeTo(room.controller);
            if (distToController < 10) {
                score += (10 - distToController) * 2;
            }
        }
        
        // 3. BONUS : Éviter les bords de la room
        let distFromEdge = Math.min(pos.x, 49 - pos.x, pos.y, 49 - pos.y);
        score += distFromEdge;
        
        // 4. BONUS : Pas sur un swamp (coûte plus cher en déplacement)
        let terrain = room.getTerrain();
        if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_SWAMP) {
            score += 10;
        }
        
        // 5. BONUS : Déjà une road à cet endroit
        let structures = pos.lookFor(LOOK_STRUCTURES);
        if (structures.some(s => s.structureType === STRUCTURE_ROAD)) {
            score += 15;
        }
        
        return score;
    },
    
    /**
     * Génère un rapport sur l'état des containers sources
     * @param {Room} room - La room
     * @returns {string}
     */
    generateContainerReport: function(room) {
        let sources = room.find(FIND_SOURCES);
        let report = '\n  📦 CONTAINERS SOURCES:\n';
        
        for (let i = 0; i < sources.length; i++) {
            let source = sources[i];
            
            // Container existant
            let container = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0];
            
            // Site de construction
            let site = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0];
            
            let status = '';
            if (container) {
                let hp = ((container.hits / container.hitsMax) * 100).toFixed(0);
                let energy = ((container.store[RESOURCE_ENERGY] / container.store.getCapacity(RESOURCE_ENERGY)) * 100).toFixed(0);
                status = `✅ Construit (HP: ${hp}%, Energy: ${energy}%)`;
            } else if (site) {
                let progress = ((site.progress / site.progressTotal) * 100).toFixed(0);
                status = `🚧 En construction (${progress}%)`;
            } else {
                status = `❌ MANQUANT`;
            }
            
            report += `    Source ${i + 1}: ${status}\n`;
            
            if (!container && !site) {
                let bestPos = this.findBestContainerPosition(source);
                if (bestPos) {
                    report += `      └─ Position suggérée: (${bestPos.x}, ${bestPos.y})\n`;
                } else {
                    report += `      └─ ⚠️ Aucune position valide trouvée\n`;
                }
            }
        }
        
        return report;
    },
    
    /**
     * Mode AUTO : Place automatiquement tous les containers manquants
     * À appeler dans main.js à chaque tick ou périodiquement
     * @param {Room} room - La room
     * @returns {boolean} True si des containers ont été placés
     */
    autoPlace: function(room) {
        // Ne placer que si on est en phase BOOTSTRAP ou CONSTRUCTION
        let miners = _.filter(Game.creeps, c => c.memory.role == 'miner').length;
        if (miners > 0) {
            // En production, ne pas replacer automatiquement
            return false;
        }
        
        let placed = this.placeAllMissingContainers(room);
        return placed > 0;
    },
    
    /**
     * Commande manuelle pour forcer le placement
     * Usage dans console: require('module.autoContainerPlacer').forcePlaceAll()
     */
    forcePlaceAll: function() {
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                console.log(`\n[AUTO-PLACER] Traitement de ${roomName}...`);
                this.placeAllMissingContainers(room);
            }
        }
    }
};