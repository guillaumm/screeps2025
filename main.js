/*
 * main.js - VERSION AVEC SYSTÈME DE TÂCHES
 * Génère une liste de tâches avec positions et priorités
 * Assigne les tâches aux creeps de manière basique
 */

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
    
    // Afficher les tâches (debug)
    if (Game.time % 10 === 0) {
        console.log(`📋 ${tasks.length} tâches disponibles`);
        tasks.slice(0, 5).forEach(t => {
            console.log(`  ${t.type}: priorité ${t.priority.toFixed(2)} @${t.pos.x},${t.pos.y}`);
        });
    }
    
    // Spawner un creep si possible
    if (!spawn.spawning) {
        spawnCreep(spawn);
    }
    
    // Faire travailler tous les creeps
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        runCreep(creep, tasks);
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
        let priority = 80 + (resource.amount / 100); // Plus y'en a, plus c'est prioritaire
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
            priority: 50, // Moins prioritaire que l'énergie déjà extraite
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
        let priority = 100; // PRIORITÉ ABSOLUE
        
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
        let priority = 60 + (1 - fillPercent) * 20; // Plus vide = plus prioritaire
        
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
        else if (site.structureType === STRUCTURE_ROAD) priority = 40;
        
        // Bonus si proche de la fin
        let progressPercent = site.progress / site.progressTotal;
        if (progressPercent > 0.8) priority += 10;
        
        tasks.push({
            type: 'build',
            targetId: site.id,
            pos: site.pos,
            priority: priority,
            amount: site.progressTotal - site.progress
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
        else if (structure.structureType === STRUCTURE_CONTAINER) priority += 5;
        
        tasks.push({
            type: 'repair',
            targetId: structure.id,
            pos: structure.pos,
            priority: priority,
            amount: structure.hitsMax - structure.hits
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
    let priority = 45; // Priorité de base basse
    
    // URGENT si risque de downgrade
    if (controller.ticksToDowngrade) {
        let downgradePercent = controller.ticksToDowngrade / 20000; // Max ~20k pour RCL 1-2
        
        if (downgradePercent < 0.2) {
            priority = 95; // CRITIQUE
        } else if (downgradePercent < 0.5) {
            priority = 70; // Urgent
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
        amount: Infinity // Toujours de l'upgrade à faire
    });
    
    return tasks;
}

/**
 * 🤖 LOGIQUE CREEP - Assigne et exécute les tâches
 */
function runCreep(creep, tasks) {
    
    let currentEnergy = creep.store[RESOURCE_ENERGY];
    let maxEnergy = creep.store.getCapacity(RESOURCE_ENERGY);
    
    // Gérer transitions d'état
    if (creep.memory.working && currentEnergy === 0) {
        creep.memory.working = false;
        creep.memory.taskId = null;
    }
    else if (!creep.memory.working && currentEnergy === maxEnergy) {
        creep.memory.working = true;
        creep.memory.taskId = null;
    }
    
    // Mode HARVEST: chercher de l'énergie
    if (!creep.memory.working) {
        let harvestTasks = tasks.filter(t => t.type === 'harvest');
        if (harvestTasks.length > 0) {
            executeTask(creep, harvestTasks[0]);
        }
        return;
    }
    
    // Mode WORKING: assigner une tâche si nécessaire
    if (!creep.memory.taskId) {
        let workTasks = tasks.filter(t => t.type !== 'harvest');
        
        if (workTasks.length > 0) {
            // Prendre la tâche la plus prioritaire
            let task = workTasks[0];
            creep.memory.taskId = task.targetId;
            creep.memory.taskType = task.type;
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
 * 👶 SPAWNING
 */
function spawnCreep(spawn) {
    let creeps = _.filter(Game.creeps);
    
    // Spawner seulement si on a moins de 5 creeps
    if (creeps.length >= 5) return;
    
    let energy = spawn.room.energyAvailable;
    
    // Corps minimal
    if (energy < 200) return;
    
    // Corps adaptatif: [WORK, CARRY, MOVE] x N
    let units = Math.floor(energy / 200);
    units = Math.min(units, 10);
    
    let body = [];
    for (let i = 0; i < units; i++) {
        body.push(WORK, CARRY, MOVE);
    }
    
    let name = 'Worker_' + Game.time;
    let result = spawn.spawnCreep(body, name, {
        memory: { 
            taskId: null,
            taskType: null,
            working: false
        }
    });
    
    if (result === OK) {
        console.log('✅ Spawned: ' + name + ' (' + body.length + ' parts)');
    }
}