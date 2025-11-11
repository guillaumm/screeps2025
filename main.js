/*
 * main.js - VERSION AVEC SYSTÈME DE TÂCHES AMÉLIORÉ
 * - Génère liste complète (harvest, transfer, build, repair, upgrade)
 * - Évite assignations multiples sur même tâche
 * - Spawn intelligent avec matelas de sécurité
 */

// Configuration
const CONFIG = {
    MAX_CREEPS: 10,
    ENERGY_SAFETY_BUFFER: 300, // Énergie à garder en réserve
    MIN_SPAWN_ENERGY: 200,
    REPORT_INTERVAL: 20
};

module.exports.loop = function () {
    
    // Nettoyage mémoire des creeps morts
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    
    // Trouver le spawn principal
    let spawn = Game.spawns['Spawn1'];
    if (!spawn) return;
    
    let room = spawn.room;
    
    // Générer la liste des tâches disponibles
    let tasks = generateTaskList(room);
    
    // Compter les assignations actuelles
    let taskAssignments = countTaskAssignments();
    
    // Afficher les tâches (debug)
    if (Game.time % CONFIG.REPORT_INTERVAL === 0) {
        reportTasks(tasks, taskAssignments);
    }
    
    // Spawner un creep si possible (avec matelas de sécurité)
    if (!spawn.spawning) {
        spawnCreepSmart(spawn);
    }
    
    // Faire travailler tous les creeps
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        runCreep(creep, tasks, taskAssignments);
    }
};

/**
 * 📋 GÉNÈRE LA LISTE COMPLÈTE DES TÂCHES
 */
function generateTaskList(room) {
    let tasks = [];
    
    // 1. HARVEST - Sources d'énergie disponibles
    tasks = tasks.concat(generateHarvestTasks(room));
    
    // 2. TRANSFER - Structures à remplir
    tasks = tasks.concat(generateTransferTasks(room));
    
    // 3. BUILD - Sites de construction
    tasks = tasks.concat(generateBuildTasks(room));
    
    // 4. REPAIR - Structures endommagées
    tasks = tasks.concat(generateRepairTasks(room));
    
    // 5. UPGRADE - Room controller
    tasks = tasks.concat(generateUpgradeTasks(room));
    
    // Trier par priorité décroissante
    tasks.sort((a, b) => b.priority - a.priority);
    
    return tasks;
}

/**
 * ⛏️ HARVEST - Récupérer de l'énergie
 */
function generateHarvestTasks(room) {
    let tasks = [];
    
    // Énergie tombée au sol
    let droppedResources = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY
    });
    
    droppedResources.forEach(resource => {
        let priority = 80 + (resource.amount / 100);
        tasks.push({
            type: 'harvest',
            subtype: 'pickup',
            targetId: resource.id,
            pos: resource.pos,
            priority: priority,
            amount: resource.amount
        });
    });
    
    // Tombstones
    let tombstones = room.find(FIND_TOMBSTONES, {
        filter: t => t.store[RESOURCE_ENERGY] > 0
    });
    
    tombstones.forEach(tomb => {
        let priority = 85 + (tomb.store[RESOURCE_ENERGY] / 100);
        tasks.push({
            type: 'harvest',
            subtype: 'withdraw',
            targetId: tomb.id,
            pos: tomb.pos,
            priority: priority,
            amount: tomb.store[RESOURCE_ENERGY]
        });
    });
    
    // Containers avec énergie
    let containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER && 
                     s.store[RESOURCE_ENERGY] > 100
    });
    
    containers.forEach(container => {
        let priority = 70 + (container.store[RESOURCE_ENERGY] / 200);
        tasks.push({
            type: 'harvest',
            subtype: 'withdraw',
            targetId: container.id,
            pos: container.pos,
            priority: priority,
            amount: container.store[RESOURCE_ENERGY]
        });
    });
    
    // Sources actives (si pas assez d'énergie passive)
    let sources = room.find(FIND_SOURCES_ACTIVE);
    sources.forEach(source => {
        tasks.push({
            type: 'harvest',
            subtype: 'mine',
            targetId: source.id,
            pos: source.pos,
            priority: 50,
            amount: source.energy
        });
    });
    
    return tasks;
}

/**
 * 📦 TRANSFER - Remplir les structures
 */
function generateTransferTasks(room) {
    let tasks = [];
    
    // Spawns et extensions
    let structures = room.find(FIND_MY_STRUCTURES, {
        filter: s => (
            s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_EXTENSION
        ) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    structures.forEach(structure => {
        let capacity = structure.store.getFreeCapacity(RESOURCE_ENERGY);
        let priority = 100;
        
        // Encore plus urgent si spawn complètement vide
        if (structure.structureType === STRUCTURE_SPAWN && 
            structure.store[RESOURCE_ENERGY] === 0) {
            priority = 110;
        }
        
        tasks.push({
            type: 'transfer',
            targetId: structure.id,
            pos: structure.pos,
            priority: priority,
            amount: capacity
        });
    });
    
    // Tours (moins prioritaire)
    let towers = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER &&
                     s.store.getFreeCapacity(RESOURCE_ENERGY) > 100
    });
    
    towers.forEach(tower => {
        let fillPercent = tower.store[RESOURCE_ENERGY] / tower.store.getCapacity(RESOURCE_ENERGY);
        let priority = 60 + (1 - fillPercent) * 20;
        
        tasks.push({
            type: 'transfer',
            targetId: tower.id,
            pos: tower.pos,
            priority: priority,
            amount: tower.store.getFreeCapacity(RESOURCE_ENERGY)
        });
    });
    
    // Storage (si existe, basse priorité)
    if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        tasks.push({
            type: 'transfer',
            targetId: room.storage.id,
            pos: room.storage.pos,
            priority: 30,
            amount: room.storage.store.getFreeCapacity(RESOURCE_ENERGY)
        });
    }
    
    return tasks;
}

/**
 * 🔨 BUILD - Construire
 */
function generateBuildTasks(room) {
    let tasks = [];
    
    let sites = room.find(FIND_CONSTRUCTION_SITES);
    
    sites.forEach(site => {
        let priority = 65;
        
        // Prioriser selon le type
        if (site.structureType === STRUCTURE_SPAWN) priority = 95;
        else if (site.structureType === STRUCTURE_EXTENSION) priority = 85;
        else if (site.structureType === STRUCTURE_TOWER) priority = 80;
        else if (site.structureType === STRUCTURE_CONTAINER) priority = 75;
        else if (site.structureType === STRUCTURE_STORAGE) priority = 70;
        else if (site.structureType === STRUCTURE_ROAD) priority = 40;
        else if (site.structureType === STRUCTURE_WALL) priority = 35;
        else if (site.structureType === STRUCTURE_RAMPART) priority = 35;
        
        // Bonus si proche de la fin
        let progressPercent = site.progress / site.progressTotal;
        if (progressPercent > 0.8) priority += 10;
        
        tasks.push({
            type: 'build',
            targetId: site.id,
            pos: site.pos,
            priority: priority,
            amount: site.progressTotal - site.progress,
            structureType: site.structureType
        });
    });
    
    return tasks;
}

/**
 * 🔧 REPAIR - Réparer
 */
function generateRepairTasks(room) {
    let tasks = [];
    
    let structures = room.find(FIND_STRUCTURES, {
        filter: s => s.hits < s.hitsMax && 
                     s.structureType !== STRUCTURE_WALL &&
                     s.structureType !== STRUCTURE_RAMPART
    });
    
    structures.forEach(structure => {
        let hitsPercent = structure.hits / structure.hitsMax;
        
        // Ignorer si > 80% HP (sauf critique)
        if (hitsPercent > 0.8) return;
        
        let priority = 55;
        
        // Critique si < 30% HP
        if (hitsPercent < 0.3) {
            priority = 90;
        }
        // Urgent si < 50% HP
        else if (hitsPercent < 0.5) {
            priority = 75;
        }
        
        // Prioriser types importants
        if (structure.structureType === STRUCTURE_SPAWN) priority += 20;
        else if (structure.structureType === STRUCTURE_TOWER) priority += 15;
        else if (structure.structureType === STRUCTURE_EXTENSION) priority += 10;
        else if (structure.structureType === STRUCTURE_CONTAINER) priority += 5;
        
        tasks.push({
            type: 'repair',
            targetId: structure.id,
            pos: structure.pos,
            priority: priority,
            amount: structure.hitsMax - structure.hits,
            structureType: structure.structureType
        });
    });
    
    return tasks;
}

/**
 * ⚡ UPGRADE - Améliorer le controller
 */
function generateUpgradeTasks(room) {
    let tasks = [];
    
    if (!room.controller || !room.controller.my) return tasks;
    
    let controller = room.controller;
    let priority = 45;
    
    // URGENT si risque de downgrade
    if (controller.ticksToDowngrade) {
        let downgradePercent = controller.ticksToDowngrade / 20000;
        
        if (downgradePercent < 0.2) {
            priority = 95;
        } else if (downgradePercent < 0.5) {
            priority = 70;
        }
    }
    
    // Si proche de level up, augmenter priorité
    if (controller.level < 8 && controller.progress) {
        let progressPercent = controller.progress / controller.progressTotal;
        if (progressPercent > 0.9) priority += 15;
    }
    
    tasks.push({
        type: 'upgrade',
        targetId: controller.id,
        pos: controller.pos,
        priority: priority,
        amount: Infinity
    });
    
    return tasks;
}

/**
 * 📊 COMPTE LES ASSIGNATIONS ACTUELLES
 * Retourne {targetId: nombre_de_creeps}
 */
function countTaskAssignments() {
    let assignments = {};
    
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        if (creep.memory.taskId) {
            if (!assignments[creep.memory.taskId]) {
                assignments[creep.memory.taskId] = 0;
            }
            assignments[creep.memory.taskId]++;
        }
    }
    
    return assignments;
}

/**
 * 🤖 LOGIQUE CREEP - Assigne et exécute les tâches
 */
function runCreep(creep, tasks, taskAssignments) {
    
    let currentEnergy = creep.store[RESOURCE_ENERGY];
    let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
    
    // Gérer transitions d'état
    if (creep.memory.working && currentEnergy === 0) {
        creep.memory.working = false;
        creep.memory.taskId = null;
        creep.memory.taskType = null;
    }
    else if (!creep.memory.working && currentEnergy === maxEnergy) {
        creep.memory.working = true;
        creep.memory.taskId = null;
        creep.memory.taskType = null;
    }
    
    // Mode HARVEST: chercher de l'énergie
    if (!creep.memory.working) {
        let harvestTasks = tasks.filter(t => t.type === 'harvest');
        if (harvestTasks.length > 0) {
            // Prendre une tâche harvest non saturée
            let task = findAvailableTask(harvestTasks, taskAssignments, 2); // Max 2 creeps par source
            if (task) {
                creep.memory.taskId = task.targetId;
                creep.memory.taskType = task.type;
                executeTask(creep, task);
            }
        }
        return;
    }
    
    // Mode WORKING: assigner une tâche si nécessaire
    if (!creep.memory.taskId) {
        let workTasks = tasks.filter(t => t.type !== 'harvest');
        
        if (workTasks.length > 0) {
            // Prendre une tâche non saturée
            let task = findAvailableTask(workTasks, taskAssignments, 1);
            
            if (task) {
                creep.memory.taskId = task.targetId;
                creep.memory.taskType = task.type;
            }
        }
    }
    
    // Exécuter la tâche assignée
    if (creep.memory.taskId) {
        let task = tasks.find(t => t.targetId === creep.memory.taskId);
        
        if (task) {
            executeTask(creep, task);
        } else {
            // Tâche terminée ou n'existe plus
            creep.memory.taskId = null;
            creep.memory.taskType = null;
        }
    }
}

/**
 * 🎯 TROUVE UNE TÂCHE DISPONIBLE (non saturée)
 * maxAssignments: nombre max de creeps par tâche
 */
function findAvailableTask(tasks, taskAssignments, maxAssignments) {
    for (let task of tasks) {
        let currentAssignments = taskAssignments[task.targetId] || 0;
        
        // Upgrade peut avoir plusieurs creeps
        if (task.type === 'upgrade') {
            maxAssignments = 5;
        }
        
        if (currentAssignments < maxAssignments) {
            return task;
        }
    }
    
    // Si tout est saturé, retourner la première tâche quand même
    return tasks[0] || null;
}

/**
 * ⚙️ EXÉCUTE UNE TÂCHE
 */
function executeTask(creep, task) {
    let target = Game.getObjectById(task.targetId);
    if (!target) return;
    
    let result;
    
    switch(task.type) {
        case 'harvest':
            if (task.subtype === 'pickup') {
                result = creep.pickup(target);
            } else if (task.subtype === 'withdraw') {
                result = creep.withdraw(target, RESOURCE_ENERGY);
            } else if (task.subtype === 'mine') {
                result = creep.harvest(target);
            }
            break;
            
        case 'transfer':
            result = creep.transfer(target, RESOURCE_ENERGY);
            break;
            
        case 'build':
            result = creep.build(target);
            break;
            
        case 'repair':
            result = creep.repair(target);
            break;
            
        case 'upgrade':
            result = creep.upgradeController(target);
            break;
    }
    
    // Se déplacer si pas à portée
    if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {
            reusePath: 10,
            visualizePathStyle: {stroke: getTaskColor(task.type)}
        });
    }
}

/**
 * 🎨 Couleurs de visualisation
 */
function getTaskColor(taskType) {
    switch(taskType) {
        case 'harvest': return '#ffaa00';
        case 'transfer': return '#ffffff';
        case 'build': return '#00ff00';
        case 'repair': return '#0000ff';
        case 'upgrade': return '#ff00ff';
        default: return '#808080';
    }
}

/**
 * 👶 SPAWN INTELLIGENT avec matelas de sécurité
 */
function spawnCreepSmart(spawn) {
    let room = spawn.room;
    let creeps = _.filter(Game.creeps);
    
    // Ne pas dépasser le max
    if (creeps.length >= CONFIG.MAX_CREEPS) return;
    
    let availableEnergy = room.energyAvailable;
    let capacityEnergy = room.energyCapacityAvailable;
    
    // Calculer l'énergie utilisable (en gardant un buffer)
    let usableEnergy = Math.max(
        CONFIG.MIN_SPAWN_ENERGY,
        availableEnergy - CONFIG.ENERGY_SAFETY_BUFFER
    );
    
    // Ne spawn que si on a assez pour un creep minimal
    if (usableEnergy < CONFIG.MIN_SPAWN_ENERGY) return;
    
    // URGENCE: aucun creep, utiliser toute l'énergie disponible
    if (creeps.length === 0) {
        usableEnergy = availableEnergy;
        console.log('🚨 EMERGENCY SPAWN');
    }
    // Si peu de creeps (< 3), être plus agressif
    else if (creeps.length < 3) {
        usableEnergy = Math.min(capacityEnergy, availableEnergy - 100);
    }
    
    // Corps adaptatif: [WORK, CARRY, MOVE] x N
    let units = Math.floor(usableEnergy / 200);
    units = Math.min(units, 10);
    
    if (units === 0) return;
    
    let body = [];
    for (let i = 0; i < units; i++) {
        body.push(WORK, CARRY, MOVE);
    }
    
    let bodyCost = units * 200;
    
    // Vérifier qu'on a bien l'énergie
    if (bodyCost > availableEnergy) return;
    
    let name = 'Worker_' + Game.time;
    let result = spawn.spawnCreep(body, name, {
        memory: { 
            taskId: null,
            taskType: null,
            working: false
        }
    });
    
    if (result === OK) {
        console.log(`✅ Spawned ${name}: ${body.length} parts, ${bodyCost}E (buffer: ${CONFIG.ENERGY_SAFETY_BUFFER}E)`);
    }
}

/**
 * 📊 RAPPORT DES TÂCHES
 */
function reportTasks(tasks, taskAssignments) {
    console.log(`\n📋 ${tasks.length} TÂCHES DISPONIBLES`);
    console.log('─'.repeat(50));
    
    // Compter par type
    let byType = {};
    tasks.forEach(t => {
        if (!byType[t.type]) byType[t.type] = 0;
        byType[t.type]++;
    });
    
    console.log('Par type:');
    for (let type in byType) {
        console.log(`  ${type}: ${byType[type]}`);
    }
    
    console.log('\nTop 5 priorités:');
    tasks.slice(0, 5).forEach(t => {
        let assigned = taskAssignments[t.targetId] || 0;
        let label = t.structureType || t.subtype || '';
        console.log(`  ${t.type} ${label}: ${t.priority.toFixed(1)} [${assigned} creep(s)]`);
    });
    
    // Statistiques creeps
    let totalCreeps = Object.keys(Game.creeps).length;
    let working = _.filter(Game.creeps, c => c.memory.working).length;
    let harvesting = totalCreeps - working;
    
    console.log(`\n🤖 ${totalCreeps} creeps: ${working} work, ${harvesting} harvest`);
}