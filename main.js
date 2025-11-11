/*
 * main.js - ARCHITECTURE À RÔLES DIFFÉRENCIÉS
 * 
 * APPROCHE SYSTÉMIQUE :
 * - Miners : Sous-système PRODUCTION (Sources → Containers/Extensions)
 * - Workers : Sous-système LOGISTIQUE (Énergie disponible → Travail)
 * 
 * Chaque acteur a un périmètre clair et des objectifs non-conflictuels
 */

// Configuration
const CONFIG = {
    MAX_CREEPS: 10,
    MINERS_PER_SOURCE: 2,
    MIN_WORKERS: 3,
    ENERGY_SAFETY_BUFFER: 300,
    MIN_SPAWN_ENERGY: 200,
    REPORT_INTERVAL: 20
};

module.exports.loop = function () {
    
    // Nettoyage mémoire
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    
    // 🔧 MIGRATION : Convertir anciens creeps en workers
    migrateOldCreeps();
    
    let spawn = Game.spawns['Spawn1'];
    if (!spawn) return;
    
    let room = spawn.room;
    
    // Analyser la population
    let population = analyzePopulation();
    
    // Générer les tâches pour chaque type
    let minerTasks = generateMinerTasks(room);
    let workerTasks = generateWorkerTasks(room);
    
    // Affichage périodique
    if (Game.time % CONFIG.REPORT_INTERVAL === 0) {
        reportStatus(population, minerTasks, workerTasks);
    }
    
    // Spawner selon les besoins
    if (!spawn.spawning) {
        spawnCreepSmart(spawn, population);
    }
    
    // Exécuter les rôles
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        
        if (creep.memory.role === 'miner') {
            runMiner(creep, minerTasks);
        } else if (creep.memory.role === 'worker') {
            runWorker(creep, workerTasks);
        }
    }
};

/**
 * 🔄 MIGRATION DES ANCIENS CREEPS
 * Convertit automatiquement les creeps sans rôle en workers
 */
function migrateOldCreeps() {
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        
        // Si pas de rôle défini, c'est un ancien creep
        if (!creep.memory.role) {
            console.log(`🔄 Migration: ${name} → worker`);
            creep.memory.role = 'worker';
            creep.memory.working = false;
            creep.memory.taskId = null;
            creep.memory.sourceId = null;
            // Nettoyer anciennes propriétés
            delete creep.memory.taskType;
        }
    }
}

/**
 * 📊 ANALYSE DE LA POPULATION
 */
function analyzePopulation() {
    let miners = _.filter(Game.creeps, c => c.memory.role === 'miner');
    let workers = _.filter(Game.creeps, c => c.memory.role === 'worker');
    
    return {
        miners: miners,
        workers: workers,
        minerCount: miners.length,
        workerCount: workers.length,
        total: miners.length + workers.length
    };
}

/**
 * ⛏️ GÉNÉRATION DES TÂCHES MINERS
 * Objectif : Extraire énergie des sources et remplir extensions proches
 */
function generateMinerTasks(room) {
    let tasks = [];
    let sources = room.find(FIND_SOURCES);
    
    sources.forEach(source => {
        // Trouver containers près de la source
        let containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        // Trouver extensions proches (range 5)
        let nearbyExtensions = source.pos.findInRange(FIND_MY_STRUCTURES, 5, {
            filter: s => (s.structureType === STRUCTURE_EXTENSION || 
                         s.structureType === STRUCTURE_SPAWN) &&
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        tasks.push({
            sourceId: source.id,
            sourcePos: source.pos,
            hasContainer: containers.length > 0,
            containerId: containers.length > 0 ? containers[0].id : null,
            nearbyExtensions: nearbyExtensions.map(e => e.id),
            assignedMiners: 0,
            maxMiners: CONFIG.MINERS_PER_SOURCE
        });
    });
    
    return tasks;
}

/**
 * 🔨 GÉNÉRATION DES TÂCHES WORKERS
 * Objectif : Récupérer énergie passive et l'utiliser (build/repair/upgrade)
 */
function generateWorkerTasks(room) {
    let tasks = {
        harvest: [],
        work: []
    };
    
    // === HARVEST : Sources d'énergie passives ===
    
    // 1. Énergie au sol (haute priorité)
    let droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    });
    droppedEnergy.forEach(resource => {
        tasks.harvest.push({
            type: 'pickup',
            targetId: resource.id,
            pos: resource.pos,
            priority: 90,
            amount: resource.amount
        });
    });
    
    // 2. Tombstones
    let tombstones = room.find(FIND_TOMBSTONES, {
        filter: t => t.store[RESOURCE_ENERGY] > 50
    });
    tombstones.forEach(tomb => {
        tasks.harvest.push({
            type: 'withdraw',
            targetId: tomb.id,
            pos: tomb.pos,
            priority: 85,
            amount: tomb.store[RESOURCE_ENERGY]
        });
    });
    
    // 3. Containers pleins
    let containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER &&
                     s.store[RESOURCE_ENERGY] > 200
    });
    containers.forEach(container => {
        tasks.harvest.push({
            type: 'withdraw',
            targetId: container.id,
            pos: container.pos,
            priority: 70,
            amount: container.store[RESOURCE_ENERGY]
        });
    });
    
    // 4. Storage (dernier recours)
    if (room.storage && room.storage.store[RESOURCE_ENERGY] > 1000) {
        tasks.harvest.push({
            type: 'withdraw',
            targetId: room.storage.id,
            pos: room.storage.pos,
            priority: 40,
            amount: room.storage.store[RESOURCE_ENERGY]
        });
    }
    
    // === WORK : Tâches de travail ===
    
    // 1. TRANSFER - Spawns/Extensions/Towers vides
    let structures = room.find(FIND_MY_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_SPAWN ||
                     s.structureType === STRUCTURE_EXTENSION ||
                     s.structureType === STRUCTURE_TOWER) &&
                     s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    structures.forEach(structure => {
        let priority = structure.structureType === STRUCTURE_SPAWN ? 100 : 95;
        tasks.work.push({
            type: 'transfer',
            targetId: structure.id,
            pos: structure.pos,
            priority: priority,
            structureType: structure.structureType
        });
    });
    
    // 2. BUILD
    let sites = room.find(FIND_CONSTRUCTION_SITES);
    sites.forEach(site => {
        let priority = 60;
        if (site.structureType === STRUCTURE_EXTENSION) priority = 80;
        else if (site.structureType === STRUCTURE_TOWER) priority = 75;
        else if (site.structureType === STRUCTURE_CONTAINER) priority = 70;
        
        tasks.work.push({
            type: 'build',
            targetId: site.id,
            pos: site.pos,
            priority: priority,
            structureType: site.structureType
        });
    });
    
    // 3. REPAIR
    let damagedStructures = room.find(FIND_STRUCTURES, {
        filter: s => s.hits < s.hitsMax * 0.7 &&
                     s.structureType !== STRUCTURE_WALL &&
                     s.structureType !== STRUCTURE_RAMPART
    });
    damagedStructures.forEach(structure => {
        let hitsPercent = structure.hits / structure.hitsMax;
        let priority = hitsPercent < 0.3 ? 85 : 55;
        
        tasks.work.push({
            type: 'repair',
            targetId: structure.id,
            pos: structure.pos,
            priority: priority,
            structureType: structure.structureType
        });
    });
    
    // 4. UPGRADE
    if (room.controller && room.controller.my) {
        let priority = 45;
        
        if (room.controller.ticksToDowngrade) {
            let downgradePercent = room.controller.ticksToDowngrade / 20000;
            if (downgradePercent < 0.3) priority = 90;
        }
        
        tasks.work.push({
            type: 'upgrade',
            targetId: room.controller.id,
            pos: room.controller.pos,
            priority: priority
        });
    }
    
    // Trier par priorité
    tasks.harvest.sort((a, b) => b.priority - a.priority);
    tasks.work.sort((a, b) => b.priority - a.priority);
    
    return tasks;
}

/**
 * ⛏️ LOGIQUE MINER
 * Rôle : Extraire énergie d'UNE source et remplir extensions proches
 */
function runMiner(creep, minerTasks) {
    
    // Si pas encore assigné à une source
    if (!creep.memory.sourceId) {
        // Trouver une source qui a besoin de miners
        for (let task of minerTasks) {
            if (task.assignedMiners < task.maxMiners) {
                creep.memory.sourceId = task.sourceId;
                creep.memory.extensions = task.nearbyExtensions;
                task.assignedMiners++;
                break;
            }
        }
    }
    
    if (!creep.memory.sourceId) return;
    
    let source = Game.getObjectById(creep.memory.sourceId);
    if (!source) {
        creep.memory.sourceId = null;
        return;
    }
    
    let currentEnergy = creep.store[RESOURCE_ENERGY];
    let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
    
    // États
    if (creep.memory.delivering && currentEnergy === 0) {
        creep.memory.delivering = false;
    } else if (!creep.memory.delivering && currentEnergy === maxEnergy) {
        creep.memory.delivering = true;
    }
    
    // === MODE DELIVERING : Remplir extensions proches ===
    if (creep.memory.delivering) {
        let extensions = creep.memory.extensions || [];
        let target = null;
        
        for (let extId of extensions) {
            let ext = Game.getObjectById(extId);
            if (ext && ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                target = ext;
                break;
            }
        }
        
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}});
            }
        } else {
            // Plus d'extensions à remplir, retourner à la source
            creep.memory.delivering = false;
        }
    }
    // === MODE MINING : Extraire de la source ===
    else {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
    }
}

/**
 * 🔨 LOGIQUE WORKER
 * Rôle : Récupérer énergie passive et travailler
 */
function runWorker(creep, workerTasks) {
    
    let currentEnergy = creep.store[RESOURCE_ENERGY];
    let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
    
    // États
    if (creep.memory.working && currentEnergy === 0) {
        creep.memory.working = false;
        creep.memory.taskId = null;
    } else if (!creep.memory.working && currentEnergy === maxEnergy) {
        creep.memory.working = true;
        creep.memory.taskId = null;
    }
    
    // === MODE HARVEST : Récupérer énergie passive ===
    if (!creep.memory.working) {
        if (workerTasks.harvest.length > 0) {
            let task = workerTasks.harvest[0];
            let target = Game.getObjectById(task.targetId);
            
            if (target) {
                let result;
                if (task.type === 'pickup') {
                    result = creep.pickup(target);
                } else {
                    result = creep.withdraw(target, RESOURCE_ENERGY);
                }
                
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
        }
        return;
    }
    
    // === MODE WORKING : Exécuter tâches ===
    if (!creep.memory.taskId && workerTasks.work.length > 0) {
        creep.memory.taskId = workerTasks.work[0].targetId;
    }
    
    if (creep.memory.taskId) {
        let task = workerTasks.work.find(t => t.targetId === creep.memory.taskId);
        
        if (!task) {
            creep.memory.taskId = null;
            return;
        }
        
        let target = Game.getObjectById(task.targetId);
        if (!target) {
            creep.memory.taskId = null;
            return;
        }
        
        let result;
        if (task.type === 'transfer') {
            result = creep.transfer(target, RESOURCE_ENERGY);
        } else if (task.type === 'build') {
            result = creep.build(target);
        } else if (task.type === 'repair') {
            result = creep.repair(target);
        } else if (task.type === 'upgrade') {
            result = creep.upgradeController(target);
        }
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                reusePath: 10,
                visualizePathStyle: {stroke: getTaskColor(task.type)}
            });
        }
    }
}

/**
 * 👶 SPAWN INTELLIGENT
 */
function spawnCreepSmart(spawn, population) {
    
    if (population.total >= CONFIG.MAX_CREEPS) return;
    
    let room = spawn.room;
    let sources = room.find(FIND_SOURCES);
    let maxMiners = sources.length * CONFIG.MINERS_PER_SOURCE;
    
    let availableEnergy = room.energyAvailable;
    let shouldSpawn = false;
    let role = null;
    let body = null;
    
    // PRIORITÉ 1 : Miners si pas assez
    if (population.minerCount < maxMiners) {
        role = 'miner';
        shouldSpawn = true;
    }
    // PRIORITÉ 2 : Workers minimum
    else if (population.workerCount < CONFIG.MIN_WORKERS) {
        role = 'worker';
        shouldSpawn = true;
    }
    // PRIORITÉ 3 : Workers supplémentaires
    else if (population.workerCount < (CONFIG.MAX_CREEPS - maxMiners)) {
        role = 'worker';
        shouldSpawn = true;
    }
    
    if (!shouldSpawn) return;
    
    // Calculer énergie utilisable
    let usableEnergy = availableEnergy;
    
    if (population.total > 0) {
        usableEnergy = Math.max(
            CONFIG.MIN_SPAWN_ENERGY,
            availableEnergy - CONFIG.ENERGY_SAFETY_BUFFER
        );
    }
    
    if (usableEnergy < CONFIG.MIN_SPAWN_ENERGY) return;
    
    // Créer corps adaptatif
    let units = Math.floor(usableEnergy / 200);
    units = Math.max(1, Math.min(units, 5));
    
    body = [];
    for (let i = 0; i < units; i++) {
        body.push(WORK, CARRY, MOVE);
    }
    
    let bodyCost = units * 200;
    if (bodyCost > availableEnergy) return;
    
    let name = role.charAt(0).toUpperCase() + role.slice(1) + '_' + Game.time;
    let result = spawn.spawnCreep(body, name, {
        memory: {
            role: role,
            working: false,
            taskId: null,
            sourceId: null
        }
    });
    
    if (result === OK) {
        console.log(`✅ Spawned ${name} (${role}): ${body.length} parts, ${bodyCost}E`);
    }
}

/**
 * 📊 RAPPORT
 */
function reportStatus(population, minerTasks, workerTasks) {
    console.log('\n' + '='.repeat(60));
    console.log(`🤖 POPULATION: ${population.minerCount} miners, ${population.workerCount} workers`);
    
    console.log('\n⛏️  MINERS:');
    minerTasks.forEach((task, i) => {
        let assigned = population.miners.filter(m => m.memory.sourceId === task.sourceId).length;
        let status = assigned >= task.maxMiners ? '✅' : '⚠️';
        console.log(`  Source ${i+1}: ${status} ${assigned}/${task.maxMiners} miners`);
    });
    
    console.log('\n🔨 WORKERS:');
    console.log(`  Harvest: ${workerTasks.harvest.length} sources`);
    console.log(`  Work: ${workerTasks.work.length} tâches`);
    
    let workByType = {};
    workerTasks.work.forEach(t => {
        workByType[t.type] = (workByType[t.type] || 0) + 1;
    });
    
    for (let type in workByType) {
        console.log(`    - ${type}: ${workByType[type]}`);
    }
}

/**
 * 🎨 Couleurs
 */
function getTaskColor(taskType) {
    const colors = {
        transfer: '#ffffff',
        build: '#00ff00',
        repair: '#0000ff',
        upgrade: '#ff00ff'
    };
    return colors[taskType] || '#808080';
}