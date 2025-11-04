/*
Module de gestion des réparations - Version refactorée
Identifie les structures à réparer et priorise les réparations
Utilise la configuration centralisée
*/

const CONFIG = require('config.orchestrator');

module.exports = {
    
    /**
     * Trouve la structure la plus importante à réparer dans une room
     * @param {Room} room - La room
     * @param {Creep} creep - Le creep qui va réparer (optionnel, pour calculer la distance)
     * @returns {Structure|null} La structure à réparer ou null
     */
    findRepairTarget: function(room, creep = null) {
        
        // Structures critiques : celles qui vont bientôt casser
        let criticalStructures = room.find(FIND_STRUCTURES, {
            filter: (s) => {
                if (!s.hits || !s.hitsMax) return false;
                
                // Ignorer les walls et ramparts (gérés séparément)
                if (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART) {
                    return false;
                }
                
                // Critique si < seuil configuré
                return s.hits < s.hitsMax * CONFIG.REPAIR_CONFIG.criticalThreshold;
            }
        });
        
        if (criticalStructures.length > 0) {
            // Réparer la structure critique la plus proche
            if (creep) {
                return creep.pos.findClosestByPath(criticalStructures);
            }
            return criticalStructures[0];
        }
        
        // Structures endommagées : celles qui ont perdu des HP
        let damagedStructures = room.find(FIND_STRUCTURES, {
            filter: (s) => {
                if (!s.hits || !s.hitsMax) return false;
                
                // Ignorer walls et ramparts
                if (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART) {
                    return false;
                }
                
                // Endommagé si < seuil configuré
                return s.hits < s.hitsMax * CONFIG.REPAIR_CONFIG.damagedThreshold;
            }
        });
        
        if (damagedStructures.length > 0) {
            // Prioriser par type de structure
            let prioritized = this.prioritizeRepairs(damagedStructures);
            
            if (creep) {
                return creep.pos.findClosestByPath(prioritized);
            }
            return prioritized[0];
        }
        
        return null;
    },
    
    /**
     * Priorise les réparations par type de structure
     * @param {Array<Structure>} structures - Liste de structures
     * @returns {Array<Structure>} Liste triée par priorité
     */
    prioritizeRepairs: function(structures) {
        // Ordre de priorité (1 = le plus important)
        const PRIORITY = {
            [STRUCTURE_SPAWN]: 1,
            [STRUCTURE_TOWER]: 2,
            [STRUCTURE_STORAGE]: 3,
            [STRUCTURE_EXTENSION]: 4,
            [STRUCTURE_LINK]: 5,
            [STRUCTURE_CONTAINER]: 6,
            [STRUCTURE_ROAD]: 7,
            [STRUCTURE_RAMPART]: 8,
            [STRUCTURE_WALL]: 9
        };
        
        return structures.sort((a, b) => {
            let priorityA = PRIORITY[a.structureType] || 10;
            let priorityB = PRIORITY[b.structureType] || 10;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // Si même priorité, réparer ce qui a le moins de HP (en %)
            let percentA = a.hits / a.hitsMax;
            let percentB = b.hits / b.hitsMax;
            return percentA - percentB;
        });
    },
    
    /**
     * Trouve un wall ou rampart à réparer (maintenance défensive)
     * @param {Room} room - La room
     * @param {number} maxHits - HP maximum à atteindre (depuis config par défaut)
     * @returns {Structure|null}
     */
    findWallToRepair: function(room, maxHits = null) {
        // Utiliser la config si maxHits n'est pas fourni
        if (maxHits === null) {
            maxHits = CONFIG.REPAIR_CONFIG.maxWallHits;
        }
        
        let walls = room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
                    && s.hits < maxHits;
            }
        });
        
        if (walls.length > 0) {
            // Réparer le wall avec le moins de HP
            walls.sort((a, b) => a.hits - b.hits);
            return walls[0];
        }
        
        return null;
    },
    
    /**
     * Compte le nombre de structures endommagées
     * @param {Room} room - La room
     * @returns {Object} Statistiques sur les réparations
     */
    getRepairStats: function(room) {
        let structures = room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits && s.hitsMax
        });
        
        let stats = {
            total: 0,
            critical: 0,     // < seuil critique configuré
            damaged: 0,      // < seuil endommagé configuré
            byType: {}
        };
        
        for (let structure of structures) {
            // Ignorer walls et ramparts pour les stats normales
            if (structure.structureType == STRUCTURE_WALL || structure.structureType == STRUCTURE_RAMPART) {
                continue;
            }
            
            stats.total++;
            
            let hpPercent = structure.hits / structure.hitsMax;
            
            if (hpPercent < CONFIG.REPAIR_CONFIG.criticalThreshold) {
                stats.critical++;
            } else if (hpPercent < CONFIG.REPAIR_CONFIG.damagedThreshold) {
                stats.damaged++;
            }
            
            // Stats par type
            let type = structure.structureType;
            if (!stats.byType[type]) {
                stats.byType[type] = { total: 0, damaged: 0 };
            }
            stats.byType[type].total++;
            if (hpPercent < CONFIG.REPAIR_CONFIG.damagedThreshold) {
                stats.byType[type].damaged++;
            }
        }
        
        return stats;
    },
    
    /**
     * Vérifie si des réparations sont nécessaires
     * @param {Room} room - La room
     * @returns {boolean}
     */
    needsRepair: function(room) {
        let stats = this.getRepairStats(room);
        return stats.critical > 0 || stats.damaged > 0;
    },
    
    /**
     * Génère un rapport sur l'état des structures
     * @param {Room} room - La room
     * @returns {string}
     */
    generateRepairReport: function(room) {
        let stats = this.getRepairStats(room);
        
        let report = '\n  🔧 RÉPARATIONS:\n';
        
        if (stats.critical > 0) {
            report += `    ⚠️  CRITIQUE: ${stats.critical} structure(s)\n`;
        }
        
        if (stats.damaged > 0) {
            report += `    🔨 Endommagées: ${stats.damaged} structure(s)\n`;
        }
        
        if (stats.critical === 0 && stats.damaged === 0) {
            report += `    ✅ Toutes les structures en bon état\n`;
        }
        
        // Détail par type si des structures sont endommagées
        if (stats.damaged > 0 || stats.critical > 0) {
            report += `    Détail:\n`;
            for (let type in stats.byType) {
                let typeStats = stats.byType[type];
                if (typeStats.damaged > 0) {
                    report += `      - ${type}: ${typeStats.damaged}/${typeStats.total} endommagées\n`;
                }
            }
        }
        
        return report;
    }
};