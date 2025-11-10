/*
main.js - CORRIGÉ
✅ Fix: Comparaison énergétique corrigée
✅ Fix: Workers créés avec le bon rôle
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
    
    // Spawn management
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
    
    // 📊 Rapport périodique
    if (Game.time % CONFIG.REPORT_INTERVAL === 0) {
        Reporter.generateReport(mainSpawn);
        reportTaskDistribution(room);
    }
};

/**
 * 🔧 SPAWN CORRIGÉ
 */
function spawnWithOrchestrator(spawn) {
    if (spawn.spawning) return;
    
    let room = spawn.room;
    
    // Compter les creeps
    let workers = _.filter(Game.creeps, c => 
        c.room.name === room.name && 
        c.memory.role === 'worker'
    ).length;
    
    let miners = MinerManager.getMinerCount(room);
    let requiredMiners = MinerManager.getRequiredMinerCount(room);
    
    let lorries = _.filter(Game.creeps, c => 
        c.memory.role === 'lorry' && 
        c.room.name === room.name
    ).length;
    
    let ldh = _.filter(Game.creeps, c => 
        c.memory.role === 'longDistanceHarvester'
    ).length;
    
    // Déterminer la phase
    let phase = getPhase(miners, requiredMiners, room);
    let quotas = CONFIG.getQuotasForPhase(phase);
    
    // Calculer les quotas réels
    let workerQuota = quotas.workers || 0;
    let minerQuota = quotas.miners === 'auto' ? requiredMiners : quotas.miners;
    let lorryQuota = quotas.lorries === 'auto' ? CONFIG.calculateLorryCount(miners) : quotas.lorries;
    
    // 🔧 PRIORITÉS DE SPAWN
    let spawnNeeds = [];
    
    // 1. CRITIQUE: Aucun creep
    if (workers === 0 && miners === 0 && lorries === 0) {
        console.log('🚨 BOOTSTRAP CRITIQUE : Aucun creep vivant !');
        spawnNeeds.push({ type: 'worker', priority: 0, emergency: true });
    }
    // 2. Miners manquants (si containers prêts)
    else if (miners < minerQuota && MinerManager.canSpawnMiners(room)) {
        let assignment = MinerManager.getNextMinerAssignment(room);
        if (assignment) {
            spawnNeeds.push({ type: 'miner', priority: 1, assignment: assignment });
        }
    }
    // 3. Workers manquants
    else if (workers < workerQuota) {
        spawnNeeds.push({ type: 'worker', priority: 2 });
    }
    // 4. Lorries (seulement si miners OK)
    else if (lorries < lorryQuota && miners > 0) {
        spawnNeeds.push({ type: 'lorry', priority: 3 });
    }
    // 5. LDH
    else if (ldh < quotas.longDistanceHarvesters) {
        spawnNeeds.push({ type: 'ldh', priority: 4 });
    }
    
    if (spawnNeeds.length === 0) return;
    
    // Spawn le plus prioritaire
    spawnNeeds.sort((a, b) => a.priority - b.priority);
    let need = spawnNeeds[0];
    
    spawnCreep(spawn, need.type, phase, need.emergency || false, need.assignment);
}

/**
 * 🔧 SPAWN CORRIGÉ - Création effective
 */
function spawnCreep(spawn, type, phase, emergency = false, assignment = null) {
    let energy;
    if (emergency) {
        energy = spawn.room.energyAvailable;
    } else if (phase === 'PRODUCTION' && CONFIG.ENERGY_CONFIG.useMaxEnergyInProduction) {
        energy = spawn.room.energyCapacityAvailable;
    } else {
        energy = spawn.room.energyAvailable;
    }
    
    let name = type.charAt(0).toUpperCase() + type.slice(1) + '_' + Game.time;
    let body, memory;
    
    switch(type) {
        case 'worker':
            body = getAdaptiveBody(energy, 'worker');
            memory = { 
                role: 'worker',
                currentTask: null,
                taskTarget: null
            };
            break;
            
        case 'miner':
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
            break;
            
        case 'lorry':
            body = getAdaptiveBody(energy, 'lorry');
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
    
    let bodyCost = calculateCost(body);
    
    // 🔧 FIX: >= au lieu de >
    if (bodyCost > energy) {
        console.log(`⏳ [${phase}] Pas assez d'énergie pour ${type} (besoin: ${bodyCost}, dispo: ${energy})`);
        return;
    }
    
    let result = spawn.spawnCreep(body, name, { memory: memory });
    
    if (result === OK) {
        let prefix = emergency ? '🚨' : '✅';
        console.log(`${prefix} [${phase}] Spawning ${type}: ${name} (${body.length} parts, ${bodyCost} energy)`);
    } else {
        console.log(`❌ Failed to spawn ${type}: ${result} (besoin: ${bodyCost}, dispo: ${energy})`);
    }
}

/**
 * Corps adaptatif selon l'énergie
 */
function getAdaptiveBody(energy, type) {
    let multiplier = CONFIG.BODY_SIZE_MULTIPLIER[type] || 1.0;
    
    if (type === 'worker') {
        if (energy < 200) {
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
function getPhase(minerCount, requiredMiners, room) {
    if (minerCount === 0) return 'BOOTSTRAP';
    
    let containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    });
    
    if (minerCount < requiredMiners || containers.length < requiredMiners) {
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
        [ATTACK]: 80
    };
    
    return body.reduce((sum, part) => sum + (COSTS[part] || 0), 0);
}

/**
 * 📊 Rapport sur la distribution des tâches
 */
function reportTaskDistribution(room) {
    const TaskManager = require('module.taskManager');
    
    let stats = TaskManager.getTaskStats(room);
    let policy = CONFIG.getActivePolicy();
    
    console.log('\n📋 DISTRIBUTION DES TÂCHES');
    console.log('-'.repeat(40));
    console.log(`  🎯 Politique active:     ${policy.name}`);
    
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
}