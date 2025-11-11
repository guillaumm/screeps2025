/*
Configuration centralisée UNIFIÉE - UN SEUL ENDROIT pour chaque réglage
🎯 Pas de doublons, paramètres cohérents entre modules
*/

module.exports = {
    
    // ========== CONFIGURATION DES ROOMS ==========
    HOME_ROOM: 'W13N57',
    TARGET_ROOM: 'W12N57',
    
    // ========== ⚙️ PARAMÈTRES CRITIQUES (utilisés partout) ==========
    
    // Distance container <-> source (DOIT être identique partout)
    CONTAINER_SOURCE_DISTANCE: 1,
    
    // Seuil minimum d'énergie dans container pour être "utilisable"
    MIN_CONTAINER_ENERGY: 50,
    
    // ========== QUOTAS DE CREEPS PAR PHASE ==========
    
    BOOTSTRAP: {
        workers: 4,
        miners: 'auto',
        lorries: 0,
        longDistanceHarvesters: 0
    },
    
    CONSTRUCTION: {
        workers: 6,
        miners: 'auto',
        lorries: 'auto',
        longDistanceHarvesters: 0
    },
    
    PRODUCTION: {
        workers: 10,  // Plus de workers en production
        miners: 'auto',
        lorries: 'auto',
        longDistanceHarvesters: 0
    },
    
    // ========== 🎯 POLITIQUES STRATÉGIQUES ==========
    
    POLICIES: {
        current: 'UPGRADE_FOCUSED',  // 🔧 Par défaut: focus upgrade
        
        BALANCED: {
            name: 'Équilibrée',
            description: 'Balance entre upgrade, construction et réparations',
            priorityModifiers: {
                upgrade: 1.2,   // Légèrement favorisé
                build: 1.0,
                repair: 0.8,
                transfer: 1.5   // Transfer important
            },
            minUpgradersRatio: 0.4  // 40% en upgrade minimum
        },
        
        UPGRADE_FOCUSED: {
            name: 'Focus Upgrade',
            description: 'Maximise la progression du controller',
            priorityModifiers: {
                upgrade: 3.0,   // 🔧 Très favorisé
                build: 0.7,
                repair: 0.5,
                transfer: 1.5
            },
            minUpgradersRatio: 0.7  // 70% en upgrade
        },
        
        BUILD_FOCUSED: {
            name: 'Focus Construction',
            description: 'Accélère les constructions',
            priorityModifiers: {
                upgrade: 0.8,
                build: 3.0,
                repair: 1.0,
                transfer: 1.5
            },
            minUpgradersRatio: 0.2
        }
    },
    
    // ========== CONFIGURATION DES TASKS ==========
    
    TASK_CONFIG: {
        // 🔧 Seuil critique pour spawns/extensions
        criticalEnergyThreshold: 0.3,  // < 30% = urgent
        
        // Gestion stricte des sources (éviter conflit miner/worker)
        strictSourceControl: true,
        allowHarvestWithoutMiner: true,
        
        // Affichage
        displayTasksWithSay: true,
        sayFrequency: 5
    },
    
    // ========== MINERS ==========
    
    MINER_CONFIG: {
        minWorkParts: 3,
        maxWorkParts: 20,
        // 🔧 DOIT correspondre à CONTAINER_SOURCE_DISTANCE
        maxContainerRange: 1,  // Corrigé de 2 → 1
        useLinksIfAvailable: true
    },
    
    // ========== LORRIES ==========
    
    LORRY_CONFIG: {
        minEnergyToDeposit: 50,
        // 🔧 Seuil pour récupérer dans containers
        minContainerEnergyToWithdraw: 50
    },
    
    // ========== RÉPARATIONS ==========
    
    REPAIR_CONFIG: {
        criticalThreshold: 0.3,      // < 30% = critique
        damagedThreshold: 0.85,      // < 85% = endommagé (répare plus tôt)
        maxWallHits: 50000
    },
    
    // ========== CONSTRUCTIONS ==========
    
    CONSTRUCTION_CONFIG: {
        // 🔧 DOIT correspondre à CONTAINER_SOURCE_DISTANCE
        sourceContainerMaxRange: 1,
        autoPlaceSourceContainers: true,
        autoPlaceInterval: 10
    },
    
    // ========== CONFIGURATION DES CORPS ==========
    
    BODY_SIZE_MULTIPLIER: {
        worker: 1.0,
        lorry: 1.0,
        miner: 1.0
    },
    
    // ========== ÉCONOMIE ==========
    
    ENERGY_CONFIG: {
        useMaxEnergyInProduction: true
    },
    
    // ========== RAPPORT ==========
    
    REPORT_INTERVAL: 100,
    DEBUG_MODE: false,
    
    // ========== MÉTHODES HELPER (NE PAS MODIFIER) ==========
    
    getQuotasForPhase: function(phase) {
        return this[phase] || this.PRODUCTION;
    },
    
    calculateLorryCount: function(minerCount) {
        return Math.max(1, Math.ceil(minerCount * 1.0));
    },
    
    hasEnoughMiners: function(room) {
        const MinerManager = require('module.minerManager');
        let minerCount = MinerManager.getMinerCount(room);
        let requiredMiners = MinerManager.getRequiredMinerCount(room);
        return minerCount >= requiredMiners;
    },
    
    getActivePolicy: function() {
        let policyName = this.POLICIES.current;
        return this.POLICIES[policyName] || this.POLICIES.BALANCED;
    },
    
    setPolicy: function(policyName) {
        if (this.POLICIES[policyName]) {
            this.POLICIES.current = policyName;
            console.log(`✅ Politique changée : ${this.POLICIES[policyName].name}`);
            console.log(`   ${this.POLICIES[policyName].description}`);
            return true;
        }
        console.log(`❌ Politique inconnue : ${policyName}`);
        return false;
    },
    
    isSourceReservedByMiner: function(sourceId) {
        if (!this.TASK_CONFIG.strictSourceControl) {
            return false;
        }
        
        let miner = _.find(Game.creeps, c => 
            c.memory.role === 'miner' && 
            c.memory.sourceId === sourceId
        );
        
        return miner !== undefined;
    },
    
    getAvailableSourcesForHarvest: function(room) {
        if (!this.TASK_CONFIG.strictSourceControl) {
            return room.find(FIND_SOURCES);
        }
        
        let sources = room.find(FIND_SOURCES);
        let available = [];
        
        for (let source of sources) {
            if (!this.isSourceReservedByMiner(source.id)) {
                available.push(source);
            }
        }
        
        return available;
    },
    
    hasSpaceForEnergy: function(structure) {
        if (structure.energy !== undefined) {
            return structure.energy < structure.energyCapacity;
        }
        
        if (structure.store) {
            return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
        
        return false;
    },
    
    getEnergyPercent: function(structure) {
        if (structure.energy !== undefined) {
            return structure.energy / structure.energyCapacity;
        }
        
        if (structure.store) {
            let capacity = structure.store.getCapacity(RESOURCE_ENERGY);
            if (capacity > 0) {
                return structure.store[RESOURCE_ENERGY] / capacity;
            }
        }
        
        return 0;
    }
};