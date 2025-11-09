/*
Main refactorisé : Workers polyvalents + Miners/Lorries spécialisés
🔧 FIX : Spawne correctement TOUS les miners nécessaires
*/

const CONFIG = require('config.orchestrator');
const MinerManager = require('module.minerManager');
const AutoContainerPlacer = require('module.autoContainerPlacer');
const Reporter = require('module.reporter');

// Charger les prototypes
require('prototype.spawn');
require('prototype.tower');
require('prototype.creep');

module.exports.loop = function () {
    
    // Nettoyage de la mémoire
    for (let name in Memory.creeps) {
        if (Game.creeps[name] == undefined) {
            delete Memory.creeps[name];
        }
    }
    
    // Trouver le spawn principal
    let mainSpawn = Game.spawns[Object.keys(Game.spawns)[0]];
    if (!mainSpawn) return;
    
    let room = mainSpawn.room;
    
    // Placement automatique des containers sources
    if (CONFIG.CONSTRUCTION_CONFIG.autoPlaceSourceContainers && 
        Game.time % CONFIG.CONSTRUCTION_CONFIG.autoPlaceInterval === 0) {
        AutoContainerPlacer.autoPlace(room);
    }
    
    // Spawn management avec orchestrateur
    spawnWithOrchestrator(mainSpawn);
    
    // Exécuter les creeps
    for (let name in Game.creeps) {
        Game.creeps[name].runRole();
    }
    
    // Tours
    for (let name in Game.structures) {
        let structure = Game.structures[name];
        if (structure.structureType == STRUCTURE_TOWER) {
            structure.defend();
        }
    }
    
    // Links (si configuré)
    if (CONFIG.LINK_BEHAVIOR.autoTransferToUpgrader) {
        manageLinkTransfers(room);
    }
    
    // Rapport périodique avec statistiques de tâches
    if (Game.time % CONFIG.REPORT_INTERVAL === 0) {
        Reporter.generateReport(mainSpawn);
        reportTaskDistribution(room);
    }
};

/**
 * 🔧 FIX : Spawn amélioré avec gestion correcte des miners multiples
 */
function spawnWithOrchestrator(spawn) {
    if (spawn.spawning) return;
    
    let room = spawn.room;
    
    // Compter les creeps par type
    let workers = _.filter(Game.creeps, c => 
        c.room.name === room.name && 
        !['miner', 'lorry', 'longDistanceHarvester'].includes(c.memory.role)
    ).length;
    
    let miners = MinerManager.getMinerCount(room);
    let lorries = _.filter(Game.creeps, c => c.memory.role === 'lorry' && c.room.name === room.name).length;
    let ldh = _.filter(Game.creeps, c => c.memory.role === 'longDistanceHarvester').length;
    
    // 🎯 NOUVEAU : Compter les miners en cours de spawn
    let minersSpawning = 0;
    for (let spawnName in Game.spawns) {
        let s = Game.spawns[spawnName];
        if (s.spawning) {
            let spawningCreep = Game.creeps[s.spawning.name];
            if (spawningCreep && spawningCreep.memory.role === 'miner') {
                minersSpawning++;
            }
        }
    }
    
    // Déterminer la phase
    let phase = getPhase(miners, room);
    let quotas = CONFIG.getQuotasForPhase(phase);
    
    // Calculer les quotas réels
    let workerQuota = (quotas.harvesters || 0) + 
                      (quotas.builders || 0) + 
                      (quotas.upgraders || 0) + 
                      (quotas.repairers || 0);
    
    let minerQuota = quotas.miners === 'auto' 
        ? MinerManager.getRequiredMinerCount(room)
        : quotas.miners;
    
    let lorryQuota = quotas.lorries === 'auto'
        ? CONFIG.calculateLorryCount(miners)
        : quotas.lorries;
    
    // Priorités de spawn
    let spawnNeeds = [];
    
    // 🔧 BOOTSTRAP CRITIQUE : Si aucun creep, TOUJOURS spawner un worker
    if (workers === 0 && miners === 0 && lorries === 0) {
        console.log('⚠️ BOOTSTRAP CRITIQUE : Aucun creep vivant !');
        spawnNeeds.push({ type: 'worker', priority: 0, emergency: true });
    }
    // 🎯 NOUVEAU : Prioriser miners si manquants (avant workers)
    else if ((miners + minersSpawning) < minerQuota && MinerManager.canSpawnMiners(room)) {
        spawnNeeds.push({ type: 'miner', priority: 1 });
    }
    // Workers polyvalents
    else if (workers < workerQuota) {
        spawnNeeds.push({ type: 'worker', priority: phase === 'BOOTSTRAP' ? 2 : 3 });
    }
    
    // Lorries (seulement si miners présents)
    if (lorries < lorryQuota && miners > 0) {
        spawnNeeds.push({ type: 'lorry', priority: 4 });
    }
    
    // LDH
    if (ldh < quotas.longDistanceHarvesters) {
        spawnNeeds.push({ type: 'ldh', priority: 5 });
    }
    
    if (spawnNeeds.length === 0) return;
    
    // Spawn le plus prioritaire
    spawnNeeds.sort((a, b) => a.priority - b.priority);
    let need = spawnNeeds[0];
    
    spawnCreep(spawn, need.type, phase, need.emergency || false);
}

/**
 * Spawne un creep du type demandé
 */
function spawnCreep(spawn, type, phase, emergency = false) {
    // En mode emergency (bootstrap critique), utiliser l'énergie disponible
    let energy;
    if (emergency) {
        energy = spawn.room.energyAvailable;
        console.log(`🚨 Emergency spawn avec ${energy} energy`);
    } else if (phase === 'PRODUCTION' && CONFIG.ENERGY_CONFIG.useMaxEnergyInProduction) {
        energy = spawn.room.energyCapacityAvailable;
    } else {
        energy = spawn.room.energyAvailable;
    }
    
    let name = type.charAt(0).toUpperCase() + type.slice(1) + '_' + Game.time;
    let body, memory;
    
    switch(type) {
        case 'worker':
            body = getAdaptiveBody(energy, 'worker', phase);
            memory = { 
                role: 'worker',
                currentTask: null,
                taskTarget: null,
                harvestSourceId: null
            };
            break;
            
        case 'miner':
            let assignment = MinerManager.getNextMinerAssignment(spawn.room);
            if (!assignment) {
                console.log('⚠️ Pas d\'assignation de miner disponible');
                return;
            }
            
            body = MinerManager.createMinerBody(energy, CONFIG.BODY_SIZE_MULTIPLIER.miner || 1.0);
            memory = {
                role: 'miner',
                sourceId: assignment.sourceId,
                linkId: assignment.linkId
            };
            
            console.log(`🔍 Spawning miner for source ${assignment.sourceId.substring(0, 5)}...`);
            break;
            
        case 'lorry':
            body = getAdaptiveBody(energy, 'lorry', phase);
            memory = { role: 'lorry', working: false };
            break;
            
        case 'ldh':
            body = [MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,ATTACK];
            memory = {
                role: 'longDistanceHarvester',
                home: CONFIG.HOME_ROOM,
                target: CONFIG.TARGET_ROOM,
                working: false
            };
            break;
    }
    
    let result = spawn.spawnCreep(body, name, { memory: memory });
    
    if (result === OK) {
        let prefix = emergency ? '🚨' : '✅';
        console.log(`${prefix} [${phase}] Spawning ${type}: ${name} (${body.length} parts, ${calculateCost(body)} energy)`);
    } else if (result !== OK && result !== ERR_NOT_ENOUGH_ENERGY) {
        console.log(`❌ Failed to spawn ${type}: ${result}`);
    }
}

/**
 * Génère un corps adaptatif selon l'énergie disponible
 */
function getAdaptiveBody(energy, type, phase) {
    let multiplier = CONFIG.BODY_SIZE_MULTIPLIER[type] || 1.0;
    
    if (type === 'worker') {
        // Corps minimal : 200 energy = [WORK, CARRY, MOVE]
        if (energy < 200) {
            // Bootstrap critique : 300 energy minimum
            if (energy >= 300) {
                return [WORK, CARRY, MOVE, WORK, CARRY, MOVE];
            }
            return [WORK, CARRY, MOVE];
        }
        
        // Calculer combien d'unités [WORK, CARRY, MOVE] on peut faire
        let units = Math.floor(energy / 200);
        units = Math.floor(units * multiplier);
        units = Math.min(units, 16); // Max 48 parts
        
        let body = [];
        for (let i = 0; i < units; i++) {
            body.push(WORK, CARRY, MOVE);
        }
        return body;
    }
    
    if (type === 'lorry') {
        // Corps minimal : 150 energy = [CARRY, CARRY, MOVE]
        if (energy < 150) {
            return [CARRY, MOVE];
        }
        
        let units = Math.floor(energy / 150);
        units = Math.floor(units * multiplier);
        units = Math.min(units, 16); // Max 48 parts
        
        let body = [];
        for (let i = 0; i < units; i++) {
            body.push(CARRY, CARRY, MOVE);
        }
        return body;
    }
    
    return [WORK, CARRY, MOVE];
}

/**
 * Détermine la phase actuelle
 */
function getPhase(minerCount, room) {
    if (minerCount === 0) return 'BOOTSTRAP';
    
    let sources = room.find(FIND_SOURCES);
    let containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    });
    
    if (minerCount < sources.length || containers.length < sources.length) {
        return 'CONSTRUCTION';
    }
    
    return 'PRODUCTION';
}

/**
 * Calcule le coût d'un corps
 */
function calculateCost(body) {
    const COSTS = {
        [WORK]: 100,
        [CARRY]: 50,
        [MOVE]: 50,
        [ATTACK]: 80,
        [RANGED_ATTACK]: 150,
        [HEAL]: 250,
        [CLAIM]: 600,
        [TOUGH]: 10
    };
    
    return body.reduce((sum, part) => sum + (COSTS[part] || 0), 0);
}

/**
 * Gestion des transferts de links
 */
function manageLinkTransfers(room) {
    let links = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LINK
    });
    
    if (links.length < 2) return;
    
    // Links sources (avec miners)
    let sourceLinks = links.filter((link, index) => 
        CONFIG.LINK_BEHAVIOR.sourceLinksIndexes.includes(index)
    );
    
    // Links cibles (upgrader, storage)
    let targetLinks = links.filter((link, index) => 
        CONFIG.LINK_BEHAVIOR.targetLinksIndexes.includes(index)
    );
    
    for (let sourceLink of sourceLinks) {
        if (sourceLink.store[RESOURCE_ENERGY] >= CONFIG.LINK_BEHAVIOR.minEnergyToTransfer) {
            for (let targetLink of targetLinks) {
                if (targetLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                    sourceLink.transferEnergy(targetLink);
                    break;
                }
            }
        }
    }
}