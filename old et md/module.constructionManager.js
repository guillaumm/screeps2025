/*
Module de gestion des constructions - Priorise les containers sources
Identifie et priorise les sites de construction critiques
*/

const CONFIG = require('config.orchestrator');

// Configuration spécifique à ce module (à ajouter dans config.orchestrator.js)
// CONSTRUCTION_CONFIG: {
//     sourceContainerMaxRange: 1,  // CRITIQUE: Miner se place sur le container, distance = 1 !
//     minBuildersForSourceContainers: 2,
//     buildersPrioritizeSourceContainers: true
// }

module.exports = {
    
    /**
     * Trouve le site de construction le plus prioritaire
     * @param {Room} room - La room
     * @param {Creep} creep - Le creep qui va construire (optionnel)
     * @returns {ConstructionSite|null}
     */
    findPriorityConstructionSite: function(room, creep = null) {
        let allSites = room.find(FIND_CONSTRUCTION_SITES);
        
        if (allSites.length === 0) {
            return null;
        }
        
        // Prioriser les sites
        let prioritized = this.prioritizeConstructionSites(room, allSites);
        
        if (creep) {
            // Chercher le site prioritaire le plus proche
            return creep.pos.findClosestByPath(prioritized);
        }
        
        return prioritized[0];
    },
    
    /**
     * Priorise les sites de construction
     * @param {Room} room - La room
     * @param {Array<ConstructionSite>} sites - Sites de construction
     * @returns {Array<ConstructionSite>} Sites triés par priorité
     */
    prioritizeConstructionSites: function(room, sites) {
        let sources = room.find(FIND_SOURCES);
        
        // Catégoriser les sites
        let categorized = sites.map(site => {
            let category = this.categorizeConstructionSite(site, sources);
            return {
                site: site,
                category: category,
                priority: this.getCategoryPriority(category),
                distance: category.sourceDistance || 999
            };
        });
        
        // Trier par priorité, puis par distance à la source (pour containers)
        categorized.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority; // Plus petit = plus prioritaire
            }
            // Si même priorité, trier par distance
            return a.distance - b.distance;
        });
        
        return categorized.map(c => c.site);
    },
    
    /**
     * Catégorise un site de construction
     * @param {ConstructionSite} site - Le site
     * @param {Array<Source>} sources - Les sources de la room
     * @returns {Object} Catégorie et infos
     */
    categorizeConstructionSite: function(site, sources) {
        let type = site.structureType;
        
        // CONTAINERS PRÈS DES SOURCES = PRIORITÉ ABSOLUE
        if (type === STRUCTURE_CONTAINER) {
            // Vérifier si le container est près d'une source
            for (let source of sources) {
                let distance = site.pos.getRangeTo(source);
                if (distance <= CONFIG.CONSTRUCTION_CONFIG.sourceContainerMaxRange) {
                    return {
                        type: 'SOURCE_CONTAINER',
                        sourceId: source.id,
                        sourceDistance: distance
                    };
                }
            }
            // Container ailleurs (moins prioritaire)
            return { type: 'OTHER_CONTAINER' };
        }
        
        // Autres structures par importance
        if (type === STRUCTURE_SPAWN) return { type: 'SPAWN' };
        if (type === STRUCTURE_TOWER) return { type: 'TOWER' };
        if (type === STRUCTURE_EXTENSION) return { type: 'EXTENSION' };
        if (type === STRUCTURE_STORAGE) return { type: 'STORAGE' };
        if (type === STRUCTURE_LINK) return { type: 'LINK' };
        if (type === STRUCTURE_ROAD) return { type: 'ROAD' };
        if (type === STRUCTURE_RAMPART) return { type: 'RAMPART' };
        if (type === STRUCTURE_WALL) return { type: 'WALL' };
        
        return { type: 'OTHER' };
    },
    
    /**
     * Retourne la priorité numérique d'une catégorie
     * Plus petit = plus prioritaire
     */
    getCategoryPriority: function(category) {
        const PRIORITIES = {
            'SOURCE_CONTAINER': 1,  // PRIORITÉ ABSOLUE
            'SPAWN': 2,
            'TOWER': 3,
            'EXTENSION': 4,
            'STORAGE': 5,
            'LINK': 6,
            'OTHER_CONTAINER': 7,
            'ROAD': 8,
            'RAMPART': 9,
            'WALL': 10,
            'OTHER': 11
        };
        
        return PRIORITIES[category.type] || 99;
    },
    
    /**
     * Compte les containers sources manquants
     * @param {Room} room - La room
     * @returns {number} Nombre de containers sources à construire
     */
    countMissingSourceContainers: function(room) {
        let sources = room.find(FIND_SOURCES);
        let missing = 0;
        
        for (let source of sources) {
            // Vérifier si un container existe ou est en construction
            let hasContainer = source.pos.findInRange(FIND_STRUCTURES, 
                CONFIG.CONSTRUCTION_CONFIG.sourceContainerMaxRange, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;
            
            let hasConstructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES,
                CONFIG.CONSTRUCTION_CONFIG.sourceContainerMaxRange, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;
            
            if (!hasContainer && !hasConstructionSite) {
                missing++;
            }
        }
        
        return missing;
    },
    
    /**
     * Vérifie si tous les containers sources sont construits
     * @param {Room} room - La room
     * @returns {boolean}
     */
    hasAllSourceContainers: function(room) {
        return this.countMissingSourceContainers(room) === 0;
    },
    
    /**
     * Génère un rapport sur les constructions
     * @param {Room} room - La room
     * @returns {string}
     */
    generateConstructionReport: function(room) {
        let sites = room.find(FIND_CONSTRUCTION_SITES);
        
        if (sites.length === 0) {
            return '\n  🏗️ CONSTRUCTIONS:\n    ✅ Aucun chantier en cours\n';
        }
        
        let report = '\n  🏗️ CONSTRUCTIONS:\n';
        
        let sources = room.find(FIND_SOURCES);
        let prioritized = this.prioritizeConstructionSites(room, sites);
        
        // Statistiques par catégorie
        let stats = {};
        for (let site of sites) {
            let category = this.categorizeConstructionSite(site, sources);
            let type = category.type;
            if (!stats[type]) {
                stats[type] = { count: 0, progress: 0, progressMax: 0 };
            }
            stats[type].count++;
            stats[type].progress += site.progress;
            stats[type].progressMax += site.progressTotal;
        }
        
        // Afficher les containers sources en priorité
        if (stats['SOURCE_CONTAINER']) {
            let pct = (stats['SOURCE_CONTAINER'].progress / stats['SOURCE_CONTAINER'].progressMax * 100).toFixed(1);
            report += `    ⚠️  CONTAINERS SOURCES: ${stats['SOURCE_CONTAINER'].count} (${pct}%)\n`;
        }
        
        // Autres catégories
        let order = ['SPAWN', 'TOWER', 'EXTENSION', 'STORAGE', 'LINK', 'OTHER_CONTAINER', 'ROAD'];
        for (let type of order) {
            if (stats[type]) {
                let pct = (stats[type].progress / stats[type].progressMax * 100).toFixed(1);
                report += `      - ${type}: ${stats[type].count} (${pct}%)\n`;
            }
        }
        
        // Progression totale
        let totalProgress = 0;
        let totalProgressMax = 0;
        for (let site of sites) {
            totalProgress += site.progress;
            totalProgressMax += site.progressTotal;
        }
        let totalPct = (totalProgress / totalProgressMax * 100).toFixed(1);
        report += `    Total: ${sites.length} chantiers (${totalPct}%)\n`;
        
        return report;
    },
    
    /**
     * Vérifie si des constructions sont nécessaires
     * @param {Room} room - La room
     * @returns {boolean}
     */
    needsConstruction: function(room) {
        return room.find(FIND_CONSTRUCTION_SITES).length > 0;
    },
    
    /**
     * Retourne le nombre de builders recommandés
     * @param {Room} room - La room
     * @returns {number}
     */
    getRecommendedBuilderCount: function(room) {
        let missing = this.countMissingSourceContainers(room);
        
        // Si des containers sources manquent, augmenter les builders
        if (missing > 0) {
            return Math.max(CONFIG.CONSTRUCTION_CONFIG.minBuildersForSourceContainers, missing);
        }
        
        // Sinon, nombre normal de builders
        let sites = room.find(FIND_CONSTRUCTION_SITES);
        if (sites.length === 0) return 0;
        if (sites.length < 3) return 1;
        if (sites.length < 6) return 2;
        return 3;
    }
};