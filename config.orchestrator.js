/*
Configuration centralisée de l'orchestrateur
Version 2.0 - Toutes les "manettes" regroupées ici
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
        repairers: 0,
        longDistanceHarvesters: 0
    },
    
    PRODUCTION: {
        harvesters: 0,
        builders: 1,
        upgraders: 4,
        miners: 'auto',
        lorries: 'auto',
        repairers: 1,
        longDistanceHarvesters: 2
    },
    
    // ========== COMPORTEMENT DES CREEPS ==========
    
    CREEP_BEHAVIOR: {
        // Les workers (builders, upgraders, repairers) récoltent aux sources directement
        // uniquement si on n'a pas assez de miners
        workersUseSourcesWhenNoMiners: true,
        
        // Les harvesters récoltent TOUJOURS aux sources (rôle de backup)
        harvestersAlwaysUseSources: true,
        
        // Les upgraders utilisent le link dédié s'il existe
        upgradersUseDedicatedLink: true,
        
        // Index du link dédié aux upgraders dans la liste des links
        // null = désactivé, 0 = premier link, 1 = deuxième link, etc.
        upgraderLinkIndex: 1,
        
        // Les lorries peuvent déposer dans les links
        lorriesDepositToLinks: false,
        
        // Les lorries ramassent l'énergie tombée au sol
        lorriesPickupDroppedEnergy: true,
        
        // Les lorries récupèrent des tombes
        lorriesLootTombstones: true,
        
        // Seuil minimum d'énergie dans un container pour qu'un lorry y récupère
        lorryMinContainerEnergy: 100
    },
    
    // ========== COMPORTEMENT DES TOURS ==========
    
    TOWER_BEHAVIOR: {
        // Les tours ne réparent que si on a assez de miners (économie d'énergie)
        repairOnlyWithMiners: true,
        
        // Seuil d'énergie minimum pour qu'une tour répare (%)
        minEnergyPercentToRepair: 0.5  // 50%
    },
    
    // ========== MINERS ==========
    
    MINER_CONFIG: {
        // Nombre minimum de WORK parts par miner
        minWorkParts: 3,
        
        // Nombre maximum de WORK parts par miner
        maxWorkParts: 20,
        
        // Distance maximale entre source et container pour créer un miner
        maxContainerRange: 2,
        
        // Les miners transfèrent vers un link s'il existe
        useLinksIfAvailable: true
    },
    
    // ========== RÉPARATIONS ==========
    
    REPAIR_CONFIG: {
        // Seuil HP pour considérer une structure comme "critique" (%)
        criticalThreshold: 0.25,  // 25%
        
        // Seuil HP pour considérer une structure comme "endommagée" (%)
        damagedThreshold: 0.75,   // 75%
        
        // HP maximum pour les walls/ramparts (réparation progressive)
        maxWallHits: 50000,
        
        // Les builders réparent automatiquement s'il n'y a pas de construction
        buildersAutoRepair: true
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
    
    // ========== ÉNERGIE ET SPAWN ==========
    
    ENERGY_CONFIG: {
        // Pourcentage minimum d'énergie avant de spawn un creep non-urgent
        minPercentForSpawn: {
            BOOTSTRAP: 0.0,      // Toujours spawn en bootstrap
            CONSTRUCTION: 0.3,   // 30% minimum
            PRODUCTION: 0.5      // 50% minimum
        },
        
        // Utiliser energyCapacityAvailable au lieu de energyAvailable en production
        useMaxEnergyInProduction: true,
        
        // Énergie minimum dans un container pour qu'un creep y récolte
        minContainerEnergy: 100
    },
    
    // ========== RAPPORT ==========
    
    REPORT_INTERVAL: 100,
    
    // ========== OPTIONS AVANCÉES ==========
    
    USE_MANUAL_SPAWN: true,
    
    // ========== MÉTHODES HELPER ==========
    
    /**
     * Récupère les quotas pour une phase donnée
     */
    getQuotasForPhase: function(phase) {
        return this[phase] || this.PRODUCTION;
    },
    
    /**
     * Calcule le nombre de lorries nécessaires
     */
    calculateLorryCount: function(minerCount) {
        return Math.max(1, Math.ceil(minerCount * 1.0));
    },
    
    /**
     * Vérifie si on a assez d'énergie pour spawn selon la phase
     */
    hasEnoughEnergyToSpawn: function(room, phase) {
        let energyPercent = room.energyAvailable / room.energyCapacityAvailable;
        let threshold = this.ENERGY_CONFIG.minPercentForSpawn[phase] || 0.5;
        return energyPercent >= threshold;
    },
    
    /**
     * Vérifie si on a assez de miners pour l'économie avancée
     */
    hasEnoughMiners: function(room) {
        const MinerManager = require('module.minerManager');
        let minerCount = MinerManager.getMinerCount(room);
        let requiredMiners = MinerManager.getRequiredMinerCount(room);
        return minerCount >= requiredMiners;
    },
    
    /**
     * Récupère le link dédié aux upgraders s'il existe
     */
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
    
    /**
     * Détermine si un creep doit utiliser les sources directement
     */
    shouldUseSourcesDirectly: function(creep, room) {
        // Les harvesters récoltent toujours aux sources
        if (creep.memory.role == 'harvester' && 
            this.CREEP_BEHAVIOR.harvestersAlwaysUseSources) {
            return true;
        }
        
        // Les workers peuvent récolter aux sources si pas assez de miners
        if (this.CREEP_BEHAVIOR.workersUseSourcesWhenNoMiners && 
            !this.hasEnoughMiners(room)) {
            return true;
        }
        
        return false;
    },
    
    /**
     * Vérifie si une tour doit réparer
     */
    shouldTowerRepair: function(tower) {
        // Vérifier le seuil d'énergie
        let energyPercent = tower.store[RESOURCE_ENERGY] / tower.store.getCapacity(RESOURCE_ENERGY);
        if (energyPercent < this.TOWER_BEHAVIOR.minEnergyPercentToRepair) {
            return false;
        }
        
        // Vérifier les miners si configuré
        if (this.TOWER_BEHAVIOR.repairOnlyWithMiners) {
            return this.hasEnoughMiners(tower.room);
        }
        
        return true;
    },
    
    /**
     * Obtient les structures cibles pour les lorries
     */
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
    }
};