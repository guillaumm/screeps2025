/*
Configuration centralisée de l'orchestrateur
Ce fichier contient tous les paramètres pour piloter la création de creeps
*/

module.exports = {
    
    // ========== CONFIGURATION DES ROOMS ==========
    HOME_ROOM: 'W13N57',
    TARGET_ROOM: 'W12N57',
    
    // ========== QUOTAS DE CREEPS PAR PHASE ==========
    
    // Phase BOOTSTRAP : Démarrage minimal
    BOOTSTRAP: {
        harvesters: 2,
        builders: 1,
        upgraders: 1,
        miners: 'auto',  // Permet de créer des miners dès qu'un container existe
        lorries: 0,      // Pas de lorries au début, les harvesters font le job
        repairers: 0,    // Pas de repairers dédiés, les builders réparent
        longDistanceHarvesters: 0
    },
    
    // Phase CONSTRUCTION : Infrastructure
    CONSTRUCTION: {
        harvesters: 1,  // Backup uniquement
        builders: 2,    // Plus de builders pour construire plus vite
        upgraders: 2,
        miners: 'auto', // Auto = 1 par source avec container
        lorries: 'auto', // Auto = 1 par miner (commence dès le 1er miner)
        repairers: 0,   // Les builders réparent en attendant
        longDistanceHarvesters: 0
    },
    
    // Phase PRODUCTION : Système complet
    PRODUCTION: {
        harvesters: 0,      // Plus besoin, les miners prennent le relais
        builders: 1,        // Maintenance uniquement
        upgraders: 4,       // Focus sur l'upgrade
        miners: 'auto',     // Auto = 1 par source
        lorries: 'auto',    // Auto = 1 par miner
        repairers: 1,       // 1 repairer dédié pour la maintenance
        longDistanceHarvesters: 2
    },
    
    // ========== CONFIGURATION DES CORPS ==========
    
    // Multiplicateur de taille des creeps (1 = normal, 2 = double, etc.)
    BODY_SIZE_MULTIPLIER: {
        worker: 1.0,    // Pour upgraders, builders, harvesters, repairers
        lorry: 1.0,     // Pour les lorries
        miner: 1.0,     // Pour les miners
        ldh: 1.0        // Pour les long distance harvesters
    },
    
    // ========== PRIORITÉS DE SPAWN ==========
    // Ordre dans lequel les creeps sont créés (1 = priorité max)
    SPAWN_PRIORITY: {
        harvesters: 1,      // Toujours en premier (backup)
        miners: 2,          // Puis miners (économie)
        lorries: 3,         // Puis lorries (transport)
        repairers: 4,       // Puis repairers (maintenance)
        upgraders: 5,       // Puis upgraders
        builders: 6,        // Puis builders
        longDistanceHarvesters: 7  // En dernier
    },
    
    // ========== RAPPORT ==========
    REPORT_INTERVAL: 300,  // Intervalle en ticks (300 = 5 minutes à vitesse normale)
    
    // ========== OPTIONS AVANCÉES ==========
    
    // Utiliser energyCapacityAvailable au lieu de energyAvailable en production
    USE_MAX_ENERGY_IN_PRODUCTION: true,
    
    // Pourcentage minimum d'énergie avant de spawn un creep non-urgent
    MIN_ENERGY_PERCENT_FOR_SPAWN: 0.5,  // 50%
    
    // Activer le spawn manuel (main.js) ou automatique (prototype.spawn)
    USE_MANUAL_SPAWN: true,  // true = main.js, false = prototype.spawn
    
    // ========== MÉTHODE HELPER ==========
    
    /**
     * Récupère les quotas pour une phase donnée
     * @param {string} phase - 'BOOTSTRAP', 'CONSTRUCTION', ou 'PRODUCTION'
     * @returns {Object} Les quotas de creeps
     */
    getQuotasForPhase: function(phase) {
        return this[phase] || this.PRODUCTION;
    },
    
    /**
     * Calcule le nombre de lorries nécessaires
     * @param {number} minerCount - Nombre de miners actuels
     * @returns {number} Nombre de lorries nécessaires
     */
    calculateLorryCount: function(minerCount) {
        return Math.max(1, Math.ceil(minerCount * 1.0));
    },
    
    /**
     * Vérifie si on a assez d'énergie pour spawn
     * @param {Room} room - La room
     * @returns {boolean}
     */
    hasEnoughEnergyToSpawn: function(room) {
        let energyPercent = room.energyAvailable / room.energyCapacityAvailable;
        return energyPercent >= this.MIN_ENERGY_PERCENT_FOR_SPAWN;
    }
};