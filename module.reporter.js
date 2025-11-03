/*
Module de rapport : génère des rapports détaillés sur l'état de la colonie
*/

const CONFIG = require('config.orchestrator');

module.exports = {
    
    /**
     * Génère et affiche un rapport complet sur la console
     * @param {StructureSpawn} mainSpawn - Le spawn principal
     */
    generateReport: function(mainSpawn) {
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 RAPPORT DE COLONIE - Tick ' + Game.time);
        console.log('='.repeat(80));
        
        // ========== SECTION 1 : POPULATION ==========
        this.reportPopulation();
        
        // ========== SECTION 2 : ÉCONOMIE ==========
        this.reportEconomy(mainSpawn.room);
        
        // ========== SECTION 3 : PHASE ET INFRASTRUCTURE ==========
        this.reportInfrastructure(mainSpawn.room);
        
        // ========== SECTION 4 : CONTROLLER ==========
        this.reportController(mainSpawn.room);
        
        // ========== SECTION 5 : CPU ==========
        this.reportCPU();
        
        console.log('='.repeat(80) + '\n');
    },
    
    /**
     * Rapport sur la population de creeps
     */
    reportPopulation: function() {
        console.log('\n👥 POPULATION DES CREEPS');
        console.log('-'.repeat(40));
        
        // Comptage des creeps par rôle
        let creepCounts = {
            harvesters: 0,
            upgraders: 0,
            builders: 0,
            repairers: 0,
            miners: 0,
            lorries: 0,
            longDistanceHarvesters: 0,
            other: 0
        };
        
        let totalCreeps = 0;
        let dyingCreeps = 0;  // Creeps avec < 100 ticks de vie
        
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            let role = creep.memory.role;
            totalCreeps++;
            
            if (creep.ticksToLive < 100) {
                dyingCreeps++;
            }
            
            if (creepCounts.hasOwnProperty(role)) {
                creepCounts[role]++;
            } else {
                creepCounts.other++;
            }
        }
        
        // Affichage avec quotas configurés
        let phase = this.getCurrentPhase();
        let quotas = CONFIG.getQuotasForPhase(phase);
        
        console.log(`  Harvesters:              ${this.pad(creepCounts.harvesters)} / ${this.formatQuota(quotas.harvesters)}`);
        console.log(`  Miners:                  ${this.pad(creepCounts.miners)} / ${this.formatQuota(quotas.miners)}`);
        console.log(`  Lorries:                 ${this.pad(creepCounts.lorries)} / ${this.formatQuota(quotas.lorries)}`);
        console.log(`  Upgraders:               ${this.pad(creepCounts.upgraders)} / ${this.formatQuota(quotas.upgraders)}`);
        console.log(`  Builders:                ${this.pad(creepCounts.builders)} / ${this.formatQuota(quotas.builders)}`);
        console.log(`  Repairers:               ${this.pad(creepCounts.repairers)} / ${this.formatQuota(quotas.repairers)}`);
        console.log(`  Long Distance Harv.:     ${this.pad(creepCounts.longDistanceHarvesters)} / ${this.formatQuota(quotas.longDistanceHarvesters)}`);
        if (creepCounts.other > 0) {
            console.log(`  Autres:                  ${this.pad(creepCounts.other)}`);
        }
        console.log(`  ${'─'.repeat(38)}`);
        console.log(`  TOTAL:                   ${this.pad(totalCreeps)}`);
        if (dyingCreeps > 0) {
            console.log(`  ⚠️  Creeps mourants:      ${this.pad(dyingCreeps)} (< 100 ticks)`);
        }
    },
    
    /**
     * Rapport sur l'économie (énergie)
     */
    reportEconomy: function(room) {
        console.log('\n💰 ÉCONOMIE');
        console.log('-'.repeat(40));
        
        // Énergie disponible
        let energyAvailable = room.energyAvailable;
        let energyCapacity = room.energyCapacityAvailable;
        let energyPercent = (energyAvailable / energyCapacity * 100).toFixed(1);
        
        console.log(`  Énergie disponible:      ${energyAvailable} / ${energyCapacity} (${energyPercent}%)`);
        
        // Storage
        if (room.storage) {
            let storageEnergy = room.storage.store[RESOURCE_ENERGY];
            let storageCapacity = room.storage.store.getCapacity();
            let storagePercent = (storageEnergy / storageCapacity * 100).toFixed(1);
            console.log(`  Storage:                 ${storageEnergy} / ${storageCapacity} (${storagePercent}%)`);
        } else {
            console.log(`  Storage:                 Non construit`);
        }
        
        // Containers
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER
        });
        
        let totalContainerEnergy = 0;
        let totalContainerCapacity = 0;
        
        for (let container of containers) {
            totalContainerEnergy += container.store[RESOURCE_ENERGY];
            totalContainerCapacity += container.store.getCapacity();
        }
        
        if (containers.length > 0) {
            let containerPercent = (totalContainerEnergy / totalContainerCapacity * 100).toFixed(1);
            console.log(`  Containers (${containers.length}):         ${totalContainerEnergy} / ${totalContainerCapacity} (${containerPercent}%)`);
        }
        
        // Production estimée (miners)
        let miners = _.filter(Game.creeps, c => c.memory.role == 'miner');
        let estimatedProduction = miners.length * 10 * 5; // 5 WORK parts par miner en moyenne, 10 energy/tick
        console.log(`  Production estimée:      ${estimatedProduction} energy/tick`);
    },
    
    /**
     * Rapport sur l'infrastructure
     */
    reportInfrastructure: function(room) {
        console.log('\n🏗️  INFRASTRUCTURE');
        console.log('-'.repeat(40));
        
        // Phase actuelle
        let phase = this.getCurrentPhase();
        console.log(`  Phase actuelle:          ${phase}`);
        
        // Sources et miners (utilisation du MinerManager)
        const MinerManager = require('module.minerManager');
        let sources = room.find(FIND_SOURCES);
        let minerCount = MinerManager.getMinerCount(room);
        let requiredMiners = MinerManager.getRequiredMinerCount(room);
        
        console.log(`  Sources:                 ${sources.length}`);
        console.log(`  Miners assignés:         ${minerCount} / ${requiredMiners}`);
        
        // Rapport détaillé des miners
        console.log(MinerManager.generateMinerReport(room));
        
        // Containers
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER
        });
        console.log(`  Containers:              ${containers.length} / ${sources.length}`);
        
        // Sites de construction
        let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        console.log(`  Sites construction:      ${constructionSites.length}`);
        
        if (constructionSites.length > 0) {
            let totalProgress = 0;
            let totalProgressMax = 0;
            for (let site of constructionSites) {
                totalProgress += site.progress;
                totalProgressMax += site.progressTotal;
            }
            let progressPercent = (totalProgress / totalProgressMax * 100).toFixed(1);
            console.log(`  Progression:             ${progressPercent}%`);
        }
        
        // Extensions
        let extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_EXTENSION
        });
        console.log(`  Extensions:              ${extensions.length}`);
        
        // Tours
        let towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_TOWER
        });
        console.log(`  Tours:                   ${towers.length}`);
        
        // Links
        let links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_LINK
        });
        console.log(`  Links:                   ${links.length}`);
        
        // Réparations
        const RepairManager = require('module.repairManager');
        console.log(RepairManager.generateRepairReport(room));
    },
    
    /**
     * Rapport sur le controller
     */
    reportController: function(room) {
        console.log('\n🎯 CONTROLLER');
        console.log('-'.repeat(40));
        
        let controller = room.controller;
        console.log(`  Niveau:                  RCL ${controller.level}`);
        console.log(`  Progression:             ${controller.progress} / ${controller.progressTotal}`);
        
        let progressPercent = (controller.progress / controller.progressTotal * 100).toFixed(2);
        console.log(`  Pourcentage:             ${progressPercent}%`);
        
        // Estimation temps jusqu'au prochain niveau
        let upgraders = _.filter(Game.creeps, c => c.memory.role == 'upgrader');
        let upgradeRate = 0;
        for (let upgrader of upgraders) {
            // Estimation : 1 WORK part = 1 energy/tick
            let workParts = upgrader.body.filter(p => p.type == WORK).length;
            upgradeRate += workParts;
        }
        
        if (upgradeRate > 0) {
            let ticksRemaining = (controller.progressTotal - controller.progress) / upgradeRate;
            let hoursRemaining = (ticksRemaining / 60 / 60).toFixed(1); // 1 tick ≈ 1 seconde en vitesse normale
            console.log(`  Taux upgrade:            ${upgradeRate} energy/tick`);
            console.log(`  Temps estimé RCL ${controller.level + 1}:     ${hoursRemaining} heures`);
        }
        
        console.log(`  Downgrade dans:          ${controller.ticksToDowngrade} ticks`);
    },
    
    /**
     * Rapport sur le CPU
     */
    reportCPU: function() {
        console.log('\n⚙️  CPU & BUCKET');
        console.log('-'.repeat(40));
        
        console.log(`  CPU utilisé:             ${Game.cpu.getUsed().toFixed(2)} / ${Game.cpu.limit}`);
        console.log(`  Bucket:                  ${Game.cpu.bucket} / 10000`);
        
        if (Game.cpu.bucket > 9000) {
            console.log(`  ✨ Génération de pixels activée`);
        }
    },
    
    /**
     * Détermine la phase actuelle (copié de main.js)
     */
    getCurrentPhase: function() {
        let miners = _.filter(Game.creeps, c => c.memory.role == 'miner').length;
        let spawn = Game.spawns[Object.keys(Game.spawns)[0]];
        if (!spawn) return 'UNKNOWN';
        
        let nbSources = spawn.room.find(FIND_SOURCES).length;
        let containers = spawn.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER
        }).length;
        
        if (miners == 0) return 'BOOTSTRAP';
        if (miners < nbSources || containers < nbSources) return 'CONSTRUCTION';
        return 'PRODUCTION';
    },
    
    /**
     * Helpers pour le formatage
     */
    pad: function(num) {
        return String(num).padStart(3, ' ');
    },
    
    formatQuota: function(quota) {
        if (quota === 'auto') return 'auto';
        return String(quota);
    }
};