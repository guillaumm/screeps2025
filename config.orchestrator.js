/*
Configuration centralisée de l'orchestrateur v2
Toutes les manettes pour une gestion intelligente future
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
        harvesters: 1,
        builders: 2,
        upgraders: 2,
        miners: 'auto',
        lorries: 'auto',
        repairers: 2,
        longDistanceHarvesters: 0
    },
    
    PRODUCTION: {
        harvesters: 0,
        builders: 1,
        upgraders: 4,
        miners: 'auto',
        lorries: 'auto',
        repairers: 2,
        longDistanceHarvesters: 0
    },
    
    // ========== COMPORTEMENT DES CREEPS ==========
    
    CREEP_BEHAVIOR: {
        workersUseSourcesWhenNoMiners: true,
        harvestersAlwaysUseSources: true,
        upgradersUseDedicatedLink: true,
        upgraderLinkIndex: 1,
        lorriesDepositToLinks: false,
        lorriesPickupDroppedEnergy: true,
        lorriesLootTombstones: true,
        lorryMinContainerEnergy: 100
    },
    
    // ========== COMPORTEMENT DES LORRIES ==========
    
    LORRY_BEHAVIOR: {
        // Prioriser spawn et extensions avant storage
        prioritizeSpawnExtension: true,
        
        // Énergie minimum avant de déposer (évite les petits trajets)
        minEnergyToDeposit: 50,
        
        // Préférer la cible la plus proche (true) ou la plus vide (false)
        preferClosestTarget: true,
        
        // Retourner au storage quand plein si rien d'autre à remplir
        returnToStorageWhenFull: true,
        
        // Distance max pour considérer une cible (null = pas de limite)
        maxTargetDistance: null
    },
    
    // ========== COMPORTEMENT DES HARVESTERS ==========
    
    HARVESTER_BEHAVIOR: {
        // Nombre maximum de harvesters (backup uniquement)
        maxHarvesters: 3,
        
        // Taille minimale du corps
        minimalBodySize: 200,
        
        // Toujours garder au moins 1 harvester en phase BOOTSTRAP
        alwaysSpawnOneInBootstrap: true,
        
        // Les harvesters déposent dans le storage en dernier recours
        useStorageAsLastResort: true
    },
    
    // ========== COMPORTEMENT DES BUILDERS ==========
    
    BUILDER_BEHAVIOR: {
        // Réparer quand pas de construction
        repairWhenNoConstruction: true,
        
        // Aider à upgrader quand rien à faire
        helpUpgradeWhenIdle: true,
        
        // HP maximum pour réparer les walls/ramparts
        maxWallRepairHits: 50000,
        
        // Distance max pour chercher un chantier (null = pas de limite)
        maxConstructionSiteDistance: null
    },
    
    // ========== COMPORTEMENT DES UPGRADERS ==========
    
    UPGRADER_BEHAVIOR: {
        // Énergie minimum pour commencer à upgrader
        minEnergyToUpgrade: 0,
        
        // Distance max du controller pour être efficace
        maxDistanceFromController: 3,
        
        // Upgrader plus agressivement si storage est plein
        upgradeMoreWhenStorageFull: false,
        
        // Seuil de storage "plein" (%)
        storageFullThreshold: 0.8,
        
        // Multiplicateur d'upgraders si storage plein
        storageFullUpgraderMultiplier: 1.5
    },
    
    // ========== COMPORTEMENT DES TOURS ==========
    
    TOWER_BEHAVIOR: {
        repairOnlyWithMiners: true,
        minEnergyPercentToRepair: 0.5,
        
        // Toujours attaquer en priorité même si peu d'énergie
        attackEvenWhenLowEnergy: true,
        
        // Énergie minimum pour attaquer (0 = toujours)
        minEnergyToAttack: 0,
        
        // Réparer les ramparts/walls avec la tour
        repairWalls: false,
        
        // HP minimum pour qu'une tour répare un rampart/wall
        minWallHitsToRepair: 10000
    },
    
    // ========== MINERS ==========
    
    MINER_CONFIG: {
        minWorkParts: 3,
        maxWorkParts: 20,
        maxContainerRange: 2,
        useLinksIfAvailable: true,
        
        // Remplacer un miner avant qu'il meure
        spawnReplacementBeforeDeath: true,
        
        // Ticks restants pour spawner un remplaçant
        replacementTicksBeforeDeath: 150
    },
    
    // ========== RÉPARATIONS ==========
    
    REPAIR_CONFIG: {
        criticalThreshold: 0.25,
        damagedThreshold: 0.75,
        maxWallHits: 50000,
        buildersAutoRepair: true,
        
        // Réparer progressivement (augmenter maxWallHits au fil du temps)
        progressiveWallRepair: false,
        
        // Incrément de HP pour les walls à chaque niveau RCL
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
        harvesters: 1,
        upgraders: 2,
        builders: 3,
        miners: 4,
        lorries: 5,
        repairers: 6,
        longDistanceHarvesters: 7
    },
    
    // ========== COMPORTEMENT DU SPAWN ==========
    
    SPAWN_BEHAVIOR: {
        // Permettre un spawn d'urgence même sans énergie suffisante
        allowEmergencySpawn: true,
        
        // Seuil d'énergie pour spawn d'urgence (creeps critiques uniquement)
        emergencyEnergyThreshold: 300,
        
        // Préférer des gros creeps en PRODUCTION
        preferLargeCreeps: true,
        
        // Nombre max de creeps par spawn
        maxCreepsPerSpawn: 50,
        
        // Afficher les logs de spawn
        verboseSpawnLogs: true
    },
    
    // ========== GESTION DES LINKS ==========
    
    LINK_BEHAVIOR: {
        // Transférer automatiquement vers le link upgrader
        autoTransferToUpgrader: true,
        
        // Transférer vers le link storage s'il existe
        autoTransferToStorage: true,
        
        // Énergie minimum avant de transférer
        minEnergyToTransfer: 400,
        
        // Index des links sources (miners)
        sourceLinksIndexes: [2],
        
        // Index des links cibles (upgrader, storage)
        targetLinksIndexes: [0, 1],
        
        // Cooldown entre les transferts (ticks)
        transferCooldown: 0
    },
    
    // ========== DÉFENSE ==========
    
    DEFENSIVE_BEHAVIOR: {
        // Tours attaquent en priorité sur réparations
        towersAttackFirst: true,
        
        // Safe mode automatique
        safeMode: {
            autoActivate: false,
            minHostiles: 3,
            minHostileDamage: 1000
        },
        
        // Spawner des défenseurs si attaque
        spawnDefendersOnAttack: false,
        
        // Nombre de défenseurs à spawner
        defendersPerHostile: 0.5
    },
    

        // ========== CONFIGURATION DES CONSTRUCTIONS ==========
    
    CONSTRUCTION_CONFIG: {
        // Distance max pour qu'un container soit considéré comme "container source"
        // CRITIQUE: Le miner se place SUR le container, donc distance = 1 obligatoire !
        sourceContainerMaxRange: 1,
        
        // Nombre minimum de builders quand des containers sources sont en construction
        minBuildersForSourceContainers: 2,
        
        // Les builders priorisent toujours les containers sources
        buildersPrioritizeSourceContainers: true,
        
        // Multiplier le nombre de builders si containers sources manquent
        boostBuildersForSourceContainers: true,
        
        // Pause sur les autres constructions tant que containers sources pas finis
        pauseOtherConstructionsDuringSourceContainers: false,
        
        // Placement automatique des containers sources
        autoPlaceSourceContainers: true,
        autoPlaceInterval: 10  // Vérifier tous les X ticks
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
        
        // Réserve d'énergie à ne pas toucher dans le storage
        reserveEnergy: {
            BOOTSTRAP: 0,
            CONSTRUCTION: 500,
            PRODUCTION: 1000
        },
        
        // Politique de distribution du storage
        // "balanced" = équilibré, "upgrade" = focus upgrade, "build" = focus construction
        storageDistributionPolicy: "balanced"
    },
    
    // ========== RAPPORT ==========
    
    REPORT_INTERVAL: 100,
    
    // ========== OPTIONS AVANCÉES ==========
    
    USE_MANUAL_SPAWN: true,
    
    // Mode debug (plus de logs)
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
    
    /**
     * Nouvelle méthode : vérifie si une structure a de la place pour l'énergie
     * Gère à la fois les structures avec .energy et celles avec .store
     */
    hasSpaceForEnergy: function(structure) {
        // Structures classiques (spawn, extension, tower)
        if (structure.energy !== undefined) {
            return structure.energy < structure.energyCapacity;
        }
        
        // Structures avec store (storage, container, link)
        if (structure.store) {
            return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
        
        return false;
    },
    
    /**
     * Nouvelle méthode : calcule le pourcentage de remplissage d'énergie
     */
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
    
    /**
     * Nouvelle méthode : détermine si le storage est "plein"
     */
    isStorageFull: function(room) {
        if (!room.storage) return false;
        
        let percent = this.getEnergyPercent(room.storage);
        return percent >= this.UPGRADER_BEHAVIOR.storageFullThreshold;
    }
};