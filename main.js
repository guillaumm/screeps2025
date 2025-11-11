/*
 * main.js - VERSION MINIMALISTE
 * Spawne un creep dès que possible et lui assigne des tâches basiques
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
    
    // Spawner un creep si possible
    if (!spawn.spawning) {
        spawnCreep(spawn);
    }
    
    // Faire travailler tous les creeps
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        runCreep(creep);
    }
};

/**
 * Spawne un creep avec l'énergie disponible
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
    units = Math.min(units, 10); // Max 10 unités
    
    let body = [];
    for (let i = 0; i < units; i++) {
        body.push(WORK, CARRY, MOVE);
    }
    
    let name = 'Worker_' + Game.time;
    let result = spawn.spawnCreep(body, name, {
        memory: { 
            task: null,
            working: false
        }
    });
    
    if (result === OK) {
        console.log('✅ Spawned: ' + name + ' (' + body.length + ' parts)');
    }
}

/**
 * Fait travailler un creep avec des tâches basiques
 */
function runCreep(creep) {
    
    // Gérer les états
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.memory.task = null;
    }
    else if (!creep.memory.working && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        creep.memory.working = true;
        creep.memory.task = null;
    }
    
    // Mode WORKING: déposer l'énergie
    if (creep.memory.working) {
        workingMode(creep);
    }
    // Mode HARVEST: récolter l'énergie
    else {
        harvestMode(creep);
    }
}

/**
 * Mode travail: choisir et exécuter une tâche
 */
function workingMode(creep) {
    
    // Choisir une tâche si nécessaire
    if (!creep.memory.task) {
        creep.memory.task = chooseTask(creep);
    }
    
    let task = creep.memory.task;
    
    switch(task) {
        case 'transfer':
            doTransfer(creep);
            break;
        case 'build':
            doBuild(creep);
            break;
        case 'upgrade':
            doUpgrade(creep);
            break;
        default:
            doUpgrade(creep);
    }
}

/**
 * Mode récolte: récupérer de l'énergie
 */
function harvestMode(creep) {
    
    // 1. Chercher énergie tombée
    let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    });
    
    if (droppedEnergy) {
        if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
            creep.moveTo(droppedEnergy);
        }
        return;
    }
    
    // 2. Récolter à la source
    let source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    
    if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
        }
    }
}

/**
 * Choisit la tâche la plus prioritaire
 */
function chooseTask(creep) {
    
    // 1. PRIORITÉ: Remplir spawn/extensions
    let structures = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => (
            s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_EXTENSION
        ) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    if (structures.length > 0) {
        return 'transfer';
    }
    
    // 2. Construire si des chantiers existent
    let constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (constructionSites.length > 0) {
        return 'build';
    }
    
    // 3. Upgrade par défaut
    return 'upgrade';
}

/**
 * Transfère l'énergie aux structures
 */
function doTransfer(creep) {
    let target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: s => (
            s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_TOWER
        ) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    } else {
        // Plus de cible, passer à upgrade
        creep.memory.task = 'upgrade';
    }
}

/**
 * Construit les sites de construction
 */
function doBuild(creep) {
    let target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    
    if (target) {
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    } else {
        // Plus de construction, passer à upgrade
        creep.memory.task = 'upgrade';
    }
}

/**
 * Améliore le room controller
 */
function doUpgrade(creep) {
    if (creep.room.controller) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller);
        }
    }
}