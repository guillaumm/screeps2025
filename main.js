/*
 * main.js - ARCHITECTURE À TRIPLE SYSTÈME
 * 
 * Système 1 : ÉTAT DES WORKERS (energy, mode, assignation)
 * Système 2 : LISTE DES TÂCHES (génération dynamique + priorités)
 * Système 3 : ASSIGNATION (matching workers ↔ tâches)
 */

// Configuration
const CONFIG = {
    MAX_CREEPS: 10,
    MINERS_PER_SOURCE: 2,
    MIN_WORKERS: 3,
    ENERGY_SAFETY_BUFFER: 300,
    MIN_SPAWN_ENERGY: 200,
    REPORT_INTERVAL: 20,
    
    // Limites d'assignation par type de tâche
    MAX_ASSIGNMENTS: {
        harvest: 2,      // Max 2 workers par source d'énergie
        transfer: 1,     // 1 seul worker par structure
        build: 2,        // 2 workers par site
        repair: 1,       // 1 worker par structure
        upgrade: 5       // 5 workers max sur controller
    }
};

module.exports.loop = function () {
    
    // Nettoyage mémoire
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    
    // Migration anciens creeps
    migrateOldCreeps();
    
    let spawn = Game.spawns['Spawn1'];
    if (!spawn) return;
    
    let room = spawn.room;
    
    // ========== SYSTÈME 1 : ÉTAT DES WORKERS ==========
    let population = analyzePopulation();
    
    // ========== SYSTÈME 2 : LISTE DES TÂCHES ==========
    let minerTasks = generateMinerTasks(room);
    let workerTasks = generateWorkerTasks(room);
    
    // ========== SYSTÈME 3 : ASSIGNATION ==========
    let taskAssignments = countTaskAssignments();
    
    // Affichage périodique
    if (Game.time % CONFIG.REPORT_INTERVAL === 0) {
        reportStatus(population, minerTasks, workerTasks, taskAssignments);
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
            runWorker(creep, workerTasks, taskAssignments);
        }
    }
};

/**
 * 🔄 MIGRATION DES ANCIENS CREEPS
 */
function migrateOldCreeps() {
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        
        if (!creep.memory.role) {
            console.log(`🔄 Migration: ${name} → worker`);
            creep.memory.role = 'worker';
            creep.memory.working = false;
            creep.memory.taskId = null;
            creep.memory.sourceId = null;
            delete creep.memory.taskType;
        }
    }
}

/**
 * ========== SYSTÈME 1 : ÉTAT DES WORKERS ==========
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
 * ========== SYSTÈME 2 : LISTE DES TÂCHES ==========
 */

/**
 * ⛏️ GÉNÉRATION DES TÂCHES MINERS
 */
function generateMinerTasks(room) {
    let tasks = [];
    let sources = room.find(FIND_SOURCES);
    
    sources.forEach(source => {
        let containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
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
 */
function generateWorkerTasks(room) {
    let tasks = {
        harvest: [],
        work: []
    };
    
    // === HARVEST : Sources d'énergie passives ===
    
    // 1. Énergie au sol
    let droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    });
    droppedEnergy.forEach(resource => {
        tasks.harvest.push({
            id: resource.id,
            type: 'harvest',
            subtype: 'pickup',
            targetId: resource.id,
            pos: resource.pos,
            priority: 90 + (resource.amount / 100),
            amount: resource.amount
        });
    });
    
    // 2. Tombstones
    let tombstones = room.find(FIND_TOMBSTONES, {
        filter: t => t.store[RESOURCE_ENERGY] > 50
    });
    tombstones.forEach(tomb => {
        tasks.harvest.push({
            id: tomb.id,
            type: 'harvest',
            subtype: 'withdraw',
            targetId: tomb.id,
            pos: tomb.pos,
            priority: 85 + (tomb.store[RESOURCE_ENERGY] / 100),
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
            id: container.id,
            type: 'harvest',
            subtype: 'withdraw',
            targetId: container.id,
            pos: container.pos,
            priority: 70 + (container.store[RESOURCE_ENERGY] / 200),
            amount: container.store[RESOURCE_ENERGY]
        });
    });
    
    // 4. Storage
    if (room.storage && room.storage.store[RESOURCE_ENERGY] > 1000) {
        tasks.harvest.push({
            id: room.storage.id,
            type: 'harvest',
            subtype: 'withdraw',
            targetId: room.storage.id,
            pos: room.storage.pos,
            priority: 40,
            amount: room.storage.store[RESOURCE_ENERGY]
        });
    }
    
    // === WORK : Tâches de travail ===
    
    // 1. TRANSFER - Spawns/Extensions/Towers
    let structures = room.find(FIND_MY_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_SPAWN ||
                     s.structureType === STRUCTURE_EXTENSION ||
                     s.structureType === STRUCTURE_TOWER) &&
                     s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    structures.forEach(structure => {
        let priority = 95;
        if (structure.structureType === STRUCTURE_SPAWN && 
            structure.store[RESOURCE_ENERGY] === 0) {
            priority = 110;
        }
        
        tasks.work.push({
            id: structure.id,
            type: 'transfer',
            targetId: structure.id,
            pos: structure.pos,
            priority: priority,
            structureType: structure.structureType,
            amount: structure.store.getFreeCapacity(RESOURCE_ENERGY)
        });
    });
    
    // 2. BUILD
    let sites = room.find(FIND_CONSTRUCTION_SITES);
    sites.forEach(site => {
        let priority = 60;
        
        if (site.structureType === STRUCTURE_SPAWN) priority = 95;
        else if (site.structureType === STRUCTURE_EXTENSION) priority = 85;
        else if (site.structureType === STRUCTURE_TOWER) priority = 80;
        else if (site.structureType === STRUCTURE_CONTAINER) priority = 75;
        else if (site.structureType === STRUCTURE_STORAGE) priority = 70;
        else if (site.structureType === STRUCTURE_ROAD) priority = 40;
        else if (site.structureType === STRUCTURE_WALL) priority = 35;
        else if (site.structureType === STRUCTURE_RAMPART) priority = 35;
        
        let progressPercent = site.progress / site.progressTotal;
        if (progressPercent > 0.8) priority += 10;
        
        tasks.work.push({
            id: site.id,
            type: 'build',
            targetId: site.id,
            pos: site.pos,
            priority: priority,
            structureType: site.structureType,
            amount: site.progressTotal - site.progress
        });
    });
    
    // 3. REPAIR
    let damagedStructures = room.find(FIND_STRUCTURES, {
        filter: s => s.hits < s.hitsMax &&
                     s.structureType !== STRUCTURE_WALL &&
                     s.structureType !== STRUCTURE_RAMPART
    });
    damagedStructures.forEach(structure => {
        let hitsPercent = structure.hits / structure.hitsMax;
        
        if (hitsPercent > 0.8) return;
        
        let priority = 55;
        if (hitsPercent < 0.3) priority = 90;
        else if (hitsPercent < 0.5) priority = 75;
        
        if (structure.structureType === STRUCTURE_SPAWN) priority += 20;
        else if (structure.structureType === STRUCTURE_TOWER) priority += 15;
        else if (structure.structureType === STRUCTURE_EXTENSION) priority += 10;
        else if (structure.structureType === STRUCTURE_CONTAINER) priority += 5;
        
        tasks.work.push({
            id: structure.id,
            type: 'repair',
            targetId: structure.id,
            pos: structure.pos,
            priority: priority,
            structureType: structure.structureType,
            amount: structure.hitsMax - structure.hits
        });
    });
    
    // 4. UPGRADE
    if (room.controller && room.controller.my) {
        let priority = 45;
        
        if (room.controller.ticksToDowngrade) {
            let downgradePercent = room.controller.ticksToDowngrade / 20000;
            if (downgradePercent < 0.2) priority = 95;
            else if (downgradePercent < 0.5) priority = 70;
        }
        
        if (room.controller.level < 8 && room.controller.progress) {
            let progressPercent = room.controller.progress / room.controller.progressTotal;
            if (progressPercent > 0.9) priority += 15;
        }
        
        tasks.work.push({
            id: room.controller.id,
            type: 'upgrade',
            targetId: room.controller.id,
            pos: room.controller.pos,
            priority: priority,
            amount: Infinity
        });
    }
    
    // Trier par priorité
    tasks.harvest.sort((a, b) => b.priority - a.priority);
    tasks.work.sort((a, b) => b.priority - a.priority);
    
    return tasks;
}

/**
 * ========== SYSTÈME 3 : ASSIGNATION ==========
 */

/**
 * 📊 COMPTE LES ASSIGNATIONS ACTUELLES
 */
function countTaskAssignments() {
    let assignments = {};
    
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        if (creep.memory.taskId && creep.memory.role === 'worker') {
            if (!assignments[creep.memory.taskId]) {
                assignments[creep.memory.taskId] = 0;
            }
            assignments[creep.memory.taskId]++;
        }
    }
    
    return assignments;
}

/**
 * 🎯 TROUVE LA MEILLEURE TÂCHE DISPONIBLE
 */
function findBestTask(tasks, taskAssignments) {
    for (let task of tasks) {
        let currentAssignments = taskAssignments[task.id] || 0;
        let maxAssignments = CONFIG.MAX_ASSIGNMENTS[task.type] || 1;
        
        if (currentAssignments < maxAssignments) {
            return task;
        }
    }
    
    // Si tout saturé, retourner la première quand même
    return tasks[0] || null;
}

/**
 * ========== EXÉCUTION DES RÔLES ==========
 */

/**
 * ⛏️ LOGIQUE MINER
 */
function runMiner(creep, minerTasks) {
    
    if (!creep.memory.sourceId) {
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
    
    if (creep.memory.delivering && currentEnergy === 0) {
        creep.memory.delivering = false;
    } else if (!creep.memory.delivering && currentEnergy === maxEnergy) {
        creep.memory.delivering = true;
    }
    
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
            creep.memory.delivering = false;
        }
    } else {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
    }
}

/**
 * 🔨 LOGIQUE WORKER
 */
function runWorker(creep, workerTasks, taskAssignments) {
    
    let currentEnergy = creep.store[RESOURCE_ENERGY];
    let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
    
    // ========== GESTION DES ÉTATS ==========
    if (creep.memory.working && currentEnergy === 0) {
        creep.memory.working = false;
        creep.memory.taskId = null;
    } else if (!creep.memory.working && currentEnergy === maxEnergy) {
        creep.memory.working = true;
        creep.memory.taskId = null;
    }
    
    // ========== MODE HARVEST ==========
    if (!creep.memory.working) {
        
        // Assigner une tâche harvest si nécessaire
        if (!creep.memory.taskId && workerTasks.harvest.length > 0) {
            let task = findBestTask(workerTasks.harvest, taskAssignments);
            if (task) {
                creep.memory.taskId = task.id;
            }
        }
        
        // Exécuter la tâche harvest
        if (creep.memory.taskId) {
            let task = workerTasks.harvest.find(t => t.id === creep.memory.taskId);
            
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
            if (task.subtype === 'pickup') {
                result = creep.pickup(target);
            } else {
                result = creep.withdraw(target, RESOURCE_ENERGY);
            }
            
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 10,
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            } else if (result === OK) {
                // Tâche réussie mais peut continuer
            } else if (result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) {
                // Source épuisée, chercher autre chose
                creep.memory.taskId = null;
            }
        }
        
        return;
    }
    
    // ========== MODE WORKING ==========
    
    // Assigner une tâche work si nécessaire
    if (!creep.memory.taskId && workerTasks.work.length > 0) {
        let task = findBestTask(workerTasks.work, taskAssignments);
        if (task) {
            creep.memory.taskId = task.id;
        }
    }
    
    // Exécuter la tâche work
    if (creep.memory.taskId) {
        let task = workerTasks.work.find(t => t.id === creep.memory.taskId);
        
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
        } else if (result === OK) {
            // Continuer la tâche
        } else if (result === ERR_FULL || result === ERR_INVALID_TARGET) {
            // Tâche terminée ou impossible
            creep.memory.taskId = null;
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
    
    if (population.minerCount < maxMiners) {
        role = 'miner';
        shouldSpawn = true;
    } else if (population.workerCount < CONFIG.MIN_WORKERS) {
        role = 'worker';
        shouldSpawn = true;
    } else if (population.workerCount < (CONFIG.MAX_CREEPS - maxMiners)) {
        role = 'worker';
        shouldSpawn = true;
    }
    
    if (!shouldSpawn) return;
    
    let usableEnergy = availableEnergy;
    
    if (population.total > 0) {
        usableEnergy = Math.max(
            CONFIG.MIN_SPAWN_ENERGY,
            availableEnergy - CONFIG.ENERGY_SAFETY_BUFFER
        );
    }
    
    if (usableEnergy < CONFIG.MIN_SPAWN_ENERGY) return;
    
    let units = Math.floor(usableEnergy / 200);
    units = Math.max(1, Math.min(units, 5));
    
    let body = [];
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
function reportStatus(population, minerTasks, workerTasks, taskAssignments) {
    console.log('\n' + '='.repeat(60));
    console.log(`🤖 POPULATION: ${population.minerCount} miners, ${population.workerCount} workers`);
    
    console.log('\n⛏️  MINERS:');
    minerTasks.forEach((task, i) => {
        let assigned = population.miners.filter(m => m.memory.sourceId === task.sourceId).length;
        let status = assigned >= task.maxMiners ? '✅' : '⚠️';
        console.log(`  Source ${i+1}: ${status} ${assigned}/${task.maxMiners} miners`);
    });
    
    console.log('\n🔨 WORKERS:');
    console.log(`  Harvest sources: ${workerTasks.harvest.length}`);
    console.log(`  Work tasks: ${workerTasks.work.length}`);
    
    // Détail des assignations
    let assignedWorkers = Object.keys(taskAssignments).length;
    let freeWorkers = population.workerCount - Object.values(taskAssignments).reduce((a, b) => a + b, 0);
    console.log(`  Assigned: ${assignedWorkers} tasks, Free: ${freeWorkers} workers`);
    
    // Top tâches
    console.log('\n  Top 5 work tasks:');
    workerTasks.work.slice(0, 5).forEach(t => {
        let assigned = taskAssignments[t.id] || 0;
        console.log(`    ${t.type} (${t.structureType || ''}): pri=${t.priority.toFixed(0)} [${assigned}]`);
    });
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
