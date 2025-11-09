/*
main.js - Version complète avec optimisations géographiques
*/

const CONFIG = require('config.orchestrator');
const MinerManager = require('module.minerManager');
const AutoContainerPlacer = require('module.autoContainerPlacer');
const Reporter = require('module.reporter');
const Visualizer = require('module.visualizer');

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
    
    // 📊 Rapport périodique avec toutes les métriques
    if (Game.time % CONFIG.REPORT_INTERVAL === 0) {
        Reporter.generateReport(mainSpawn);
        reportTaskDistribution(room);
        reportEfficiency(room);  // 🎯 NOUVEAU
    }
    
    // 📍 Visualisation (si debug activé)
    if (CONFIG.DEBUG_MODE) {
        Visualizer.visualizeRoom(room);
        Visualizer.displayRoomStats(room);
    }
};

/**
 * Spawn avec orchestrateur
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
    
    // Compter les miners en cours de spawn
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
    
    // 🎯 NOUVEAU : Réduire besoin de lorries si workers font le transfer
    let situation = analyzeRoomSituation(room);
    if (situation.workersDoingTransfer > 0) {
        lorryQuota = Math.max(0, lorryQuota - 1);
    }
    
    // Priorités de spawn
    let spawnNeeds = [];
    
    // Bootstrap critique
    if (workers === 0 && miners === 0 && lorries === 0) {
        console.log('⚠️ BOOTSTRAP CRITIQUE : Aucun creep vivant !');
        spawnNeeds.push({ type: 'worker', priority: 0, emergency: true });
    }
    // Miners manquants
    else if ((miners + minersSpawning) < minerQuota && MinerManager.canSpawnMiners(room)) {
        spawnNeeds.push({ type: 'miner', priority: 1 });
    }
    // Workers polyvalents
    else if (workers < workerQuota) {
        spawnNeeds.push({ type: 'worker', priority: phase === 'BOOTSTRAP' ? 2 : 3 });
    }
    
    // Lorries (seulement si vraiment nécessaires)
    if (lorries < lorryQuota && miners > 0 && situation.workersDoingTransfer < 2) {
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
 * 🎯 NOUVEAU : Analyse de la situation pour spawn adaptatif
 */
function analyzeRoomSituation(room) {
    let workers = _.filter(Game.creeps, c => 
        c.room.name === room.name && 
        !['miner', 'lorry', 'longDistanceHarvester'].includes(c.memory.role)
    );
    
    let workersDoingTransfer = 0;
    for (let creep of workers) {
        if (creep.memory.currentTask === 'transfer') {
            workersDoingTransfer++;
        }
    }
    
    return {
        workersDoingTransfer: workersDoingTransfer
    };
}

/**
 * Spawne un creep du type demandé
 */
function spawnCreep(spawn, type, phase, emergency = false) {
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
                harvestSourceId: null,
                harvestMode: null
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
            
            console.log(`🔷 Spawning miner for source ${assignment.sourceId.substring(0, 5)}...`);
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
        if (energy < 200) {
            if (energy >= 300) {
                return [WORK, CARRY, MOVE, WORK, CARRY, MOVE];
            }
            return [WORK, CARRY, MOVE];
        }
        
        let units = Math.floor(energy / 200);
        units = Math.floor(units * multiplier);
        units = Math.min(units, 16);
        
        let body = [];
        for (let i = 0; i < units; i++) {
            body.push(WORK, CARRY, MOVE);
        }
        return body;
    }
    
    if (type === 'lorry') {
        if (energy < 150) {
            return [CARRY, MOVE];
        }
        
        let units = Math.floor(energy / 150);
        units = Math.floor(units * multiplier);
        units = Math.min(units, 16);
        
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
    
    let sourceLinks = links.filter((link, index) => 
        CONFIG.LINK_BEHAVIOR.sourceLinksIndexes.includes(index)
    );
    
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

/**
 * 📊 Rapport sur la distribution des tâches
 */
function reportTaskDistribution(room) {
    const TaskManager = require('module.taskManager');
    const CONFIG = require('config.orchestrator');
    
    let stats = TaskManager.getTaskStats(room);
    let policy = CONFIG.getActivePolicy();
    
    console.log('\n📋 DISTRIBUTION DES TÂCHES');
    console.log('-'.repeat(40));
    console.log(`  📍 Politique active:     ${policy.name}`);
    console.log(`     ${policy.description}`);
    console.log('');
    
    if (stats.total === 0) {
        console.log('  Aucun worker polyvalent actif');
        return;
    }
    
    let percent = (count) => `(${(count / stats.total * 100).toFixed(1)}%)`;
    
    console.log(`  ⛏️  Harvest:              ${stats.harvest.toString().padStart(2)} ${percent(stats.harvest)}`);
    console.log(`  📦 Transfer:             ${stats.transfer.toString().padStart(2)} ${percent(stats.transfer)}`);
    console.log(`  🔨 Build:                ${stats.build.toString().padStart(2)} ${percent(stats.build)}`);
    console.log(`  🔧 Repair:               ${stats.repair.toString().padStart(2)} ${percent(stats.repair)}`);
    console.log(`  ⚡ Upgrade:              ${stats.upgrade.toString().padStart(2)} ${percent(stats.upgrade)}`);
    if (stats.idle > 0) {
        console.log(`  ❓ Idle:                 ${stats.idle.toString().padStart(2)} ${percent(stats.idle)}`);
    }
    console.log(`  ${'─'.repeat(38)}`);
    console.log(`  TOTAL Workers:           ${stats.total}`);
    
    if (stats.usingRelays > 0) {
        console.log(`  🔄 Utilisant relais:     ${stats.usingRelays}`);
    }
    
    let targetRatio = (policy.minUpgradersRatio * 100).toFixed(0);
    let actualRatio = (stats.upgrade / stats.total * 100).toFixed(0);
    let icon = actualRatio >= targetRatio ? '✅' : '⚠️';
    console.log(`  ${icon} Ratio upgrade:          ${actualRatio}% / ${targetRatio}% (objectif)`);
}

/**
 * 📊 Rapport sur l'efficacité géographique
 */
function reportEfficiency(room) {
    const TaskManager = require('module.taskManager');
    const CONFIG = require('config.orchestrator');
    
    console.log('\n⚡ EFFICACITÉ & OPTIMISATIONS');
    console.log('-'.repeat(40));
    
    let workers = _.filter(Game.creeps, c => 
        c.room.name === room.name && 
        !['miner', 'lorry', 'longDistanceHarvester'].includes(c.memory.role)
    );
    
    if (workers.length === 0) {
        console.log('  Aucun worker actif');
        return;
    }
    
    let totalDistance = 0;
    let workersWithTarget = 0;
    let workersUsingRelays = 0;
    let workersIdle = 0;
    let energyUtilization = 0;
    
    let taskDistances = {
        harvest: [],
        transfer: [],
        build: [],
        repair: [],
        upgrade: []
    };
    
    for (let creep of workers) {
        let task = creep.memory.currentTask;
        let target = Game.getObjectById(creep.memory.taskTarget);
        
        let energyPercent = creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
        energyUtilization += energyPercent;
        
        if (!task) {
            workersIdle++;
            continue;
        }
        
        if (target) {
            let distance = creep.pos.getRangeTo(target);
            totalDistance += distance;
            workersWithTarget++;
            
            if (taskDistances[task]) {
                taskDistances[task].push(distance);
            }
        }
        
        if (creep.memory.harvestMode === 'relay') {
            workersUsingRelays++;
        }
    }
    
    let avgDistance = workersWithTarget > 0 ? (totalDistance / workersWithTarget).toFixed(1) : 0;
    let avgEnergy = (energyUtilization / workers.length * 100).toFixed(1);
    
    console.log(`  Workers actifs:          ${workers.length}`);
    console.log(`  Distance moy. cible:     ${avgDistance} cases`);
    console.log(`  Énergie moyenne:         ${avgEnergy}%`);
    console.log(`  Utilisant relais:        ${workersUsingRelays}`);
    if (workersIdle > 0) {
        console.log(`  ⚠️  Inactifs:              ${workersIdle}`);
    }
    
    console.log('\n  Distances par tâche:');
    for (let task in taskDistances) {
        if (taskDistances[task].length > 0) {
            let avg = (taskDistances[task].reduce((a, b) => a + b, 0) / taskDistances[task].length).toFixed(1);
            let emoji = getTaskEmoji(task);
            console.log(`    ${emoji} ${task.padEnd(10)}: ${avg} cases (${taskDistances[task].length} workers)`);
        }
    }
    
    if (CONFIG.TASK_CONFIG.useEnergyRelays && workersUsingRelays > 0) {
        let relayEfficiency = (workersUsingRelays / workers.length * 100).toFixed(1);
        console.log(`\n  🔄 Efficacité relais:    ${relayEfficiency}%`);
    }
    
    let efficiencyScore = calculateEfficiencyScore(avgDistance, avgEnergy, workersIdle, workers.length);
    let grade = getEfficiencyGrade(efficiencyScore);
    console.log(`\n  📈 Score d'efficacité:   ${efficiencyScore}/100 (${grade})`);
}

function getTaskEmoji(task) {
    const EMOJIS = {
        'harvest': '⛏️',
        'build': '🔨',
        'repair': '🔧',
        'upgrade': '⚡',
        'transfer': '📦'
    };
    return EMOJIS[task] || '❓';
}

function calculateEfficiencyScore(avgDistance, avgEnergy, idle, total) {
    let score = 100;
    
    if (avgDistance > 5) {
        score -= Math.min(30, (avgDistance - 5) * 2);
    }
    
    if (avgEnergy < 70) {
        score -= (70 - avgEnergy) / 2;
    }
    
    let idlePercent = (idle / total) * 100;
    score -= idlePercent * 2;
    
    return Math.max(0, Math.round(score));
}

function getEfficiencyGrade(score) {
    if (score >= 90) return '⭐⭐⭐ Excellent';
    if (score >= 75) return '⭐⭐ Très bon';
    if (score >= 60) return '⭐ Bon';
    if (score >= 40) return '⚠️ Moyen';
    return '❌ Faible';
}