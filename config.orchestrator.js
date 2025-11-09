/*
Configuration centralisée de l'orchestrateur v4
NOUVEAU : Politiques stratégiques + Gestion stricte sources/containers
*/

module.exports = {
    
    // ========== CONFIGURATION DES ROOMS ==========
    HOME_ROOM: 'W13N57',
    TARGET_ROOM: 'W12N57',
    
    // ========== QUOTAS DE CREEPS PAR PHASE ==========
    
    BOOTSTRAP: {
        harvesters: 2,
        builders: 2,
        upgraders: 2,
        miners: 'auto',
        lorries: 0,
        repairers: 0,
        longDistanceHarvesters: 0
    },
    
    CONSTRUCTION: {
        harvesters: 0,  // Plus de harvesters dès qu'on a des miners
        builders: 3,
        upgraders: 2,
        miners: 'auto',
        lorries: 'auto',
        repairers: 1,
        longDistanceHarvesters: 0
    },
    
    PRODUCTION: {
        harvesters: 0,
        builders: 1,
        upgraders: 5,  // Plus d'upgraders en production
        miners: 'auto',
        lorries: 'auto',
        repairers: 2,
        longDistanceHarvesters: 0
    },
    
    // ========== 🎯 NOUVEAU : POLITIQUES STRATÉGIQUES ==========
    
    POLICIES: {
        // Politique actuelle (peut être changée dynamiquement)
        // Options : 'BALANCED', 'UPGRADE_FOCUSED', 'BUILD_FOCUSED', 'DEFENSE_FOCUSED'
        current: 'BALANCED',
        
        // Définition des politiques
        BALANCED: {
            name: 'Équilibrée',
            description: 'Balance entre upgrade, construction et réparations',
            priorityModifiers: {
                upgrade: 1.0,
                build: 1.0,
                repair: 1.0,
                transfer: 1.2  // Légère priorité au remplissage
            },
            minUpgradersRatio: 0.3,  // Au moins 30% des workers en upgrade
            allowUpgradersToHelp: true
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
            minUpgradersRatio: 0.6,  // 60% en upgrade minimum
            allowUpgradersToHelp: false  // Upgraders dédiés
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
            minUpgradersRatio: 0.2,  // 20% en upgrade minimum
            allowUpgradersToHelp: true
        },
        
        DEFENSE_FOCUSED: {
            name: 'Focus Défense',
            description: 'Priorité aux réparations et tours',
            priorityModifiers: {
                upgrade: 0.5,
                build: 0.7,
                repair: 2.0,
                transfer: 1.5  // Remplir les tours
            },
            minUpgradersRatio: 0.1,
            allowUpgradersToHelp: true
        }
    },
    
    // ========== CONFIGURATION DES TASKS ==========
    
    TASK_CONFIG: {
        // Seuils d'énergie
        criticalEnergyThreshold: 0.3,
        transferPriorityThreshold: 0.8,
        
        // 🔧 NOUVEAU : Gestion stricte des sources
        strictSourceControl: true,  // Empêcher harvest si miner présent
        allowHarvestWithoutMiner: true,  // Autoriser harvest si pas de miner
        
        // 📍 NOUVEAU : Optimisation géographique
        minEnergyToStartWork: 0.3,  // 30% minimum pour commencer une tâche productive
        useEnergyRelays: true,  // Utiliser les structures comme relais
        maxRelayDetour: 2.0,  // Facteur max de détour pour un relais (2x = acceptable)
        nearbyTaskRange: 10,  // Range pour chercher des tâches proches
        geographicBonusEnabled: true,  // Bonus pour tâches proches
        
        // Upgrade
        minUpgradersAlways: 0,
        upgradersCanDoOtherTasks: true,
        upgradeOnlyWhenNearDecay: false,
        upgradeDecayThreshold: 5000,
        
        // Affichage
        displayTasksWithSay: true,
        sayFrequency: 3
    },
    
    // ========== COMPORTEMENT DES CREEPS ==========
    
    CREEP_BEHAVIOR: {
        // 🔧 MODIFIÉ : Plus de harvest direct si miners présents
        workersUseSourcesWhenNoMiners: true,  // Seulement si AUCUN miner
        harvestersAlwaysUseSources: false,    // Même les harvesters respectent les miners
        
        upgradersUseDedicatedLink: true,
        upgraderLinkIndex: 1,
        lorriesDepositToLinks: false,
        lorriesPickupDroppedEnergy: true,
        lorriesLootTombstones: true,
        lorryMinContainerEnergy: 100
    },
    
    // ========== COMPORTEMENT DES LORRIES ==========
    
    LORRY_BEHAVIOR: {
        prioritizeSpawnExtension: true,
        minEnergyToDeposit: 50,
        preferClosestTarget: true,
        returnToStorageWhenFull: true,
        maxTargetDistance: null
    },
    
    // ========== COMPORTEMENT DES HARVESTERS ==========
    
    HARVESTER_BEHAVIOR: {
        maxHarvesters: 2,  // Réduit car on préfère les miners
        minimalBodySize: 200,
        alwaysSpawnOneInBootstrap: true,
        useStorageAsLastResort: true
    },
    
    // ========== COMPORTEMENT DES BUILDERS ==========
    
    BUILDER_BEHAVIOR: {
        repairWhenNoConstruction: true,
        helpUpgradeWhenIdle: true,
        maxWallRepairHits: 50000,
        maxConstructionSiteDistance: null
    },
    
    // ========== COMPORTEMENT DES UPGRADERS ==========
    
    UPGRADER_BEHAVIOR: {
        minEnergyToUpgrade: 0,
        maxDistanceFromController: 3,
        upgradeMoreWhenStorageFull: true,
        storageFullThreshold: 0.8,
        storageFullUpgraderMultiplier: 1.5
    },
    
    // ========== COMPORTEMENT DES TOURS ==========
    
    TOWER_BEHAVIOR: {
        repairOnlyWithMiners: true,
        minEnergyPercentToRepair: 0.5,
        attackEvenWhenLowEnergy: true,
        minEnergyToAttack: 0,
        repairWalls: false,
        minWallHitsToRepair: 10000
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
        damagedThreshold: 0.75,
        maxWallHits: 50000,
        buildersAutoRepair: true,
        progressiveWallRepair: false,
        wallHitsPerRCL: 10000
    },
    
    // ========== CONFIGURATION DES CORPS ==========
    
    BODY_SIZE_MULTIPLIER: {
        worker: 1.0,
        lorry: 1.0,
        miner: 1.0,
        ldh: 1.0
    },
    
    // ========== PRIORITÉS DE SPAWN ==========
    
    SPAWN_PRIORITY: {
        miners: 1,       // Miners en premier !
        lorries: 2,      // Puis lorries
        upgraders: 3,
        builders: 4,
        harvesters: 5,
        repairers: 6,
        longDistanceHarvesters: 7
    },
    
    // ========== COMPORTEMENT DU SPAWN ==========
    
    SPAWN_BEHAVIOR: {
        allowEmergencySpawn: true,
        emergencyEnergyThreshold: 300,
        preferLargeCreeps: true,
        maxCreepsPerSpawn: 50,
        verboseSpawnLogs: true
    },
    
    // ========== GESTION DES LINKS ==========
    
    LINK_BEHAVIOR: {
        autoTransferToUpgrader: true,
        autoTransferToStorage: true,
        minEnergyToTransfer: 400,
        sourceLinksIndexes: [2],
        targetLinksIndexes: [0, 1],
        transferCooldown: 0
    },
    
    // ========== DÉFENSE ==========
    
    DEFENSIVE_BEHAVIOR: {
        towersAttackFirst: true,
        safeMode: {
            autoActivate: false,
            minHostiles: 3,
            minHostileDamage: 1000
        },
        spawnDefendersOnAttack: false,
        defendersPerHostile: 0.5
    },
    
    // ========== CONFIGURATION DES CONSTRUCTIONS ==========
    
    CONSTRUCTION_CONFIG: {
        sourceContainerMaxRange: 1,
        minBuildersForSourceContainers: 2,
        buildersPrioritizeSourceContainers: true,
        boostBuildersForSourceContainers: true,
        pauseOtherConstructionsDuringSourceContainers: false,
        autoPlaceSourceContainers: true,
        autoPlaceInterval: 10
    },
    
    // ========== ÉCONOMIE ==========
    
    ENERGY_CONFIG: {
        minPercentForSpawn: {
            BOOTSTRAP: 0.0,
            CONSTRUCTION: 0.3,
            PRODUCTION: 0.5
        },
        useMaxEnergyInProduction: true,
        minContainerEnergy: 100,
        reserveEnergy: {
            BOOTSTRAP: 0,
            CONSTRUCTION: 500,
            PRODUCTION: 1000
        },
        storageDistributionPolicy: "balanced"
    },
    
    // ========== RAPPORT ==========
    
    REPORT_INTERVAL: 100,
    
    // ========== OPTIONS AVANCÉES ==========
    
    USE_MANUAL_SPAWN: true,
    DEBUG_MODE: false,
    
    // ========== MÉTHODES HELPER ==========
    
    getQuotasForPhase: function(phase) {
        return this[phase] || this.PRODUCTION;
    },
    
    calculateLorryCount: function(minerCount) {
        return Math.max(1, Math.ceil(minerCount * 1.0));
    },
    
    hasEnoughEnergyToSpawn: function(room, phase) {
        let energyPercent = room.energyAvailable / room.energyCapacityAvailable;
        let threshold = this.ENERGY_CONFIG.minPercentForSpawn[phase] || 0.5;
        return energyPercent >= threshold;
    },
    
    hasEnoughMiners: function(room) {
        const MinerManager = require('module.minerManager');
        let minerCount = MinerManager.getMinerCount(room);
        let requiredMiners = MinerManager.getRequiredMinerCount(room);
        return minerCount >= requiredMiners;
    },
    
    // 🎯 NOUVEAU : Récupère la politique active
    getActivePolicy: function() {
        let policyName = this.POLICIES.current;
        return this.POLICIES[policyName] || this.POLICIES.BALANCED;
    },
    
    // 🎯 NOUVEAU : Change la politique (utilisable en console)
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
    
    // 🔧 NOUVEAU : Vérifie si une source est "réservée" par un miner
    isSourceReservedByMiner: function(sourceId) {
        if (!this.TASK_CONFIG.strictSourceControl) {
            return false;
        }
        
        // Chercher si un miner est assigné à cette source
        let miner = _.find(Game.creeps, c => 
            c.memory.role === 'miner' && 
            c.memory.sourceId === sourceId
        );
        
        return miner !== undefined;
    },
    
    // 🔧 NOUVEAU : Liste les sources disponibles pour harvest direct
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
    
    getUpgraderLink: function(room) {
        if (!this.CREEP_BEHAVIOR.upgradersUseDedicatedLink) {
            return null;
        }
        
        let linkList = _.filter(Game.structures, s => 
            s.structureType == STRUCTURE_LINK && 
            s.room.name == room.name
        );
        
        let index = this.CREEP_BEHAVIOR.upgraderLinkIndex;
        if (index !== null && linkList.length > index) {
            return linkList[index];
        }
        
        return null;
    },
    
    shouldUseSourcesDirectly: function(creep, room) {
        // Si contrôle strict, vérifier les miners
        if (this.TASK_CONFIG.strictSourceControl) {
            // Seulement si AUCUN miner et autorisé
            if (this.TASK_CONFIG.allowHarvestWithoutMiner && 
                !this.hasEnoughMiners(room)) {
                return true;
            }
            return false;
        }
        
        // Ancien comportement (fallback)
        if (creep.memory.role == 'harvester' && 
            this.CREEP_BEHAVIOR.harvestersAlwaysUseSources) {
            return true;
        }
        
        if (this.CREEP_BEHAVIOR.workersUseSourcesWhenNoMiners && 
            !this.hasEnoughMiners(room)) {
            return true;
        }
        
        return false;
    },
    
    shouldTowerRepair: function(tower) {
        let energyPercent = tower.store[RESOURCE_ENERGY] / tower.store.getCapacity(RESOURCE_ENERGY);
        if (energyPercent < this.TOWER_BEHAVIOR.minEnergyPercentToRepair) {
            return false;
        }
        
        if (this.TOWER_BEHAVIOR.repairOnlyWithMiners) {
            return this.hasEnoughMiners(tower.room);
        }
        
        return true;
    },
    
    getLorryDepositTargets: function() {
        let targets = [
            STRUCTURE_SPAWN,
            STRUCTURE_EXTENSION,
            STRUCTURE_STORAGE,
            STRUCTURE_TOWER
        ];
        
        if (this.CREEP_BEHAVIOR.lorriesDepositToLinks) {
            targets.push(STRUCTURE_LINK);
        }
        
        return targets;
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
    },
    
    isStorageFull: function(room) {
        if (!room.storage) return false;
        
        let percent = this.getEnergyPercent(room.storage);
        return percent >= this.UPGRADER_BEHAVIOR.storageFullThreshold;
    }
};