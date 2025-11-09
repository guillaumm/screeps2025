/*
Configuration centralisée de l'orchestrateur v4 - NETTOYÉE
🔧 Suppression des rôles obsolètes (harvester, builder, repairer, upgrader)
✅ Seuls les rôles actifs restent: worker, miner, lorry, longDistanceHarvester
*/

module.exports = {
    
    // ========== CONFIGURATION DES ROOMS ==========
    HOME_ROOM: 'W13N57',
    TARGET_ROOM: 'W12N57',
    
    // ========== QUOTAS DE CREEPS PAR PHASE ==========
    
    BOOTSTRAP: {
        workers: 4,  // 🔧 Workers polyvalents remplacent harvesters/builders/upgraders
        miners: 'auto',
        lorries: 0,
        longDistanceHarvesters: 0
    },
    
    CONSTRUCTION: {
        workers: 6,  // 🔧 Plus de workers en construction
        miners: 'auto',
        lorries: 'auto',
        longDistanceHarvesters: 0
    },
    
    PRODUCTION: {
        workers: 8,  // 🔧 Encore plus en production
        miners: 'auto',
        lorries: 'auto',
        longDistanceHarvesters: 0
    },
    
    // ========== 🎯 POLITIQUES STRATÉGIQUES ==========
    
    POLICIES: {
        current: 'BALANCED',
        
        BALANCED: {
            name: 'Équilibrée',
            description: 'Balance entre upgrade, construction et réparations',
            priorityModifiers: {
                upgrade: 1.0,
                build: 1.0,
                repair: 1.0,
                transfer: 1.2
            },
            minUpgradersRatio: 0.3
        },
        
        UPGRADE_FOCUSED: {
            name: 'Focus Upgrade',
            description: 'Maximise la progression du controller',
            priorityModifiers: {
                upgrade: 2.0,
                build: 0.5,
                repair: 0.7,
                transfer: 1.0
            },
            minUpgradersRatio: 0.6
        },
        
        BUILD_FOCUSED: {
            name: 'Focus Construction',
            description: 'Accélère les constructions',
            priorityModifiers: {
                upgrade: 0.5,
                build: 2.0,
                repair: 1.0,
                transfer: 1.0
            },
            minUpgradersRatio: 0.2
        }
    },
    
    // ========== CONFIGURATION DES TASKS ==========
    
    TASK_CONFIG: {
        criticalEnergyThreshold: 0.5,  // 🔧 Remonté à 50%
        
        // Gestion stricte des sources
        strictSourceControl: true,
        allowHarvestWithoutMiner: true,
        
        // Affichage
        displayTasksWithSay: true,
        sayFrequency: 3
    },
    
    // ========== COMPORTEMENT DES LORRIES ==========
    
    LORRY_BEHAVIOR: {
        minEnergyToDeposit: 50,
        preferClosestTarget: true
    },
    
    // ========== MINERS ==========
    
    MINER_CONFIG: {
        minWorkParts: 3,
        maxWorkParts: 20,
        maxContainerRange: 2,
        useLinksIfAvailable: true,
        spawnReplacementBeforeDeath: true,
        replacementTicksBeforeDeath: 150
    },
    
    // ========== RÉPARATIONS ==========
    
    REPAIR_CONFIG: {
        criticalThreshold: 0.25,
        damagedThreshold: 0.8,  // 🔧 Plus haut = répare plus tôt
        maxWallHits: 50000
    },
    
    // ========== CONFIGURATION DES CORPS ==========
    
    BODY_SIZE_MULTIPLIER: {
        worker: 1.0,
        lorry: 1.0,
        miner: 1.0,
        ldh: 1.0
    },
    
    // ========== CONFIGURATION DES CONSTRUCTIONS ==========
    
    CONSTRUCTION_CONFIG: {
        sourceContainerMaxRange: 1,
        minBuildersForSourceContainers: 2,
        autoPlaceSourceContainers: true,
        autoPlaceInterval: 10
    },
    
    // ========== ÉCONOMIE ==========
    
    ENERGY_CONFIG: {
        useMaxEnergyInProduction: true,
        minContainerEnergy: 100
    },
    
    // ========== RAPPORT ==========
    
    REPORT_INTERVAL: 100,
    
    // ========== OPTIONS AVANCÉES ==========
    
    DEBUG_MODE: false,
    
    // ========== MÉTHODES HELPER ==========
    
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
        console.log(`   Politiques disponibles : ${Object.keys(this.POLICIES).filter(k => k !== 'current').join(', ')}`);
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