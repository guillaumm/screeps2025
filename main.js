/*
Version refactorisée avec système de phases de démarrage
- Phase 1 (Bootstrap) : Harvesters basiques uniquement
- Phase 2 (Construction) : Miners + Builders pour construire l'infrastructure
- Phase 3 (Production) : Système complet avec Lorries et Upgraders
*/

// main avec harvester
// import modules
require('prototype.creep');
require('prototype.tower');
require('prototype.spawn');
require('prototype.link');

// ========== CONFIGURATION GLOBALE ==========
const HOME_ROOM = 'E13S12';
const TARGET_ROOM = 'E12S12';

// Nombres de creeps souhaités (Phase 3 - Production)
const CONFIG = {
    upgraders: 4,
    builders: 1,
    longDistanceHarvesters: 2,
    lorryFactor: 1,  // 1 lorry par miner
};
// ===========================================

module.exports.loop = function() {
    
    // Récupérer le spawn principal
    let mainSpawn = Game.spawns[Object.keys(Game.spawns)[0]];
    
    // Gestion du CPU bucket
    if(Game.cpu.bucket > 9000) {
        Game.cpu.generatePixel();
    }
    
    // Initialisation mémoire
    if(!Memory.niveaux) {
        Memory.niveaux = [""];
    }
    
    // Log périodique des niveaux d'énergie
    if (Game.time % 20 == 0) {
        const storages = mainSpawn.room.find(FIND_STRUCTURES, {
            filter: s => (
                s.structureType == STRUCTURE_CONTAINER ||
                s.structureType == STRUCTURE_LINK ||
                s.structureType == STRUCTURE_STORAGE
            )
        });
        let tick_niveaux = ";" + String(Game.time) + " " + mainSpawn.room.controller.progress + " ";
        for (let i in storages) {
            tick_niveaux += " " + storages[i].structureType + i + " " + storages[i].store.energy;
        }
        console.log("tick_niveaux " + tick_niveaux);
        Memory.niveaux[0] += tick_niveaux;
    }
    
    // Nettoyage mémoire des creeps morts
    for (let name in Memory.creeps) {
        if (Game.creeps[name] == undefined) {
            delete Memory.creeps[name];
        }
    }
    
    // Exécution de tous les creeps
    for (let name in Game.creeps) {
        Game.creeps[name].runRole();
    }

    // Exécution des tours
    var towers = _.filter(Game.structures, s => s.structureType == STRUCTURE_TOWER);
    for (let tower of towers) {
        tower.defend();
    }
    
    // Gestion des links
    let linkList = _.filter(Game.structures, s => s.structureType == STRUCTURE_LINK);
    if (linkList.length >= 3) {
        let linkTo = linkList[0];
        if (linkList[1].store.getFreeCapacity(RESOURCE_ENERGY) > linkList[0].store.getFreeCapacity(RESOURCE_ENERGY)) {
            linkTo = linkList[1];
        }
        linkList[2].transferEnergy(linkTo);
    }

    // Spawn automatique via prototype
    for (let spawnName in Game.spawns) {
        Game.spawns[spawnName].spawnCreepsIfNecessary();
    }

    // ========== SYSTÈME DE SPAWN MANUEL AVEC PHASES ==========
    
    // Comptage des creeps par rôle
    let creepCounts = {
        harvesters: _.filter(Game.creeps, c => c.memory.role == 'harvester').length,
        upgraders: _.filter(Game.creeps, c => c.memory.role == 'upgrader').length,
        builders: _.filter(Game.creeps, c => c.memory.role == 'builder').length,
        miners: _.filter(Game.creeps, c => c.memory.role == 'miner').length,
        lorries: _.filter(Game.creeps, c => c.memory.role == 'lorry').length,
        longDistanceHarvesters: _.sum(Game.creeps, c => 
            c.memory.role == 'longDistanceHarvester' && c.memory.target == TARGET_ROOM
        )
    };
    
    // Détection de l'état de la base
    let nbSources = mainSpawn.room.find(FIND_SOURCES).length;
    let containers = mainSpawn.room.find(FIND_STRUCTURES, {
        filter: s => s.structureType == STRUCTURE_CONTAINER
    });
    let constructionSites = mainSpawn.room.find(FIND_CONSTRUCTION_SITES);
    
    // Déterminer la phase actuelle
    let phase = getPhase(creepCounts.miners, nbSources, containers.length, constructionSites.length);
    
    // Log de la phase (debug)
    if (Game.time % 100 == 0) {
        console.log("=== Phase actuelle: " + phase + " ===");
        console.log("Miners: " + creepCounts.miners + "/" + nbSources);
        console.log("Containers: " + containers.length);
        console.log("Sites de construction: " + constructionSites.length);
    }
    
    // Logique de spawn selon la phase
    switch(phase) {
        case 'BOOTSTRAP':
            spawnBootstrapCreeps(mainSpawn, creepCounts);
            break;
        case 'CONSTRUCTION':
            spawnConstructionCreeps(mainSpawn, creepCounts, nbSources);
            break;
        case 'PRODUCTION':
            spawnProductionCreeps(mainSpawn, creepCounts, nbSources);
            break;
    }
};

// ========== FONCTIONS DE DÉTECTION DE PHASE ==========

function getPhase(minerCount, nbSources, containerCount, constructionSiteCount) {
    // Phase BOOTSTRAP : Pas de miners, on démarre avec des harvesters
    if (minerCount == 0) {
        return 'BOOTSTRAP';
    }
    
    // Phase CONSTRUCTION : On a des miners mais pas tous les containers
    if (minerCount < nbSources || containerCount < nbSources) {
        return 'CONSTRUCTION';
    }
    
    // Phase PRODUCTION : Tous les miners et containers sont en place
    return 'PRODUCTION';
}

// ========== FONCTIONS DE SPAWN PAR PHASE ==========

function spawnBootstrapCreeps(spawn, counts) {
    // En phase bootstrap, on veut 2 harvesters minimum pour démarrer
    if (counts.harvesters < 2) {
        let newName = 'Harvester_' + Game.time;
        console.log('[BOOTSTRAP] Spawning harvester: ' + newName);
        spawn.spawnCreep([WORK,CARRY,MOVE], newName, {
            memory: {role: 'harvester', working: false}
        });
        return;
    }
    
    // Ensuite 1 builder pour construire les containers
    if (counts.builders < 1) {
        let newName = 'Builder_' + Game.time;
        console.log('[BOOTSTRAP] Spawning builder: ' + newName);
        spawn.spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY], newName, {
            memory: {role: 'builder', working: false}
        });
        return;
    }
    
    // Puis 1 upgrader pour progresser
    if (counts.upgraders < 1) {
        let newName = 'Upgrader_' + Game.time;
        console.log('[BOOTSTRAP] Spawning upgrader: ' + newName);
        spawn.spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY], newName, {
            memory: {role: 'upgrader', working: false}
        });
        return;
    }
}

function spawnConstructionCreeps(spawn, counts, nbSources) {
    // En phase construction, on maintient 1 harvester de backup
    if (counts.harvesters < 1) {
        let newName = 'Harvester_' + Game.time;
        console.log('[CONSTRUCTION] Spawning backup harvester: ' + newName);
        spawn.spawnCreep([WORK,CARRY,MOVE], newName, {
            memory: {role: 'harvester', working: false}
        });
        return;
    }
    
    // Priorité aux miners (gérés par prototype.spawn automatiquement)
    // Mais on maintient quand même des builders et upgraders
    
    if (counts.builders < 1) {
        let newName = 'Builder_' + Game.time;
        console.log('[CONSTRUCTION] Spawning builder: ' + newName);
        spawn.spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY], newName, {
            memory: {role: 'builder', working: false}
        });
        return;
    }
    
    if (counts.upgraders < 2) {
        let newName = 'Upgrader_' + Game.time;
        console.log('[CONSTRUCTION] Spawning upgrader: ' + newName);
        spawn.spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY], newName, {
            memory: {role: 'upgrader', working: false}
        });
        return;
    }
    
    // Commencer les lorries si on a au moins 1 miner
    let nbLorries = Math.max(1, counts.miners * CONFIG.lorryFactor);
    if (counts.lorries < nbLorries) {
        let newName = 'Lorry_' + Game.time;
        console.log('[CONSTRUCTION] Spawning lorry: ' + newName);
        spawn.spawnCreep([CARRY,MOVE,CARRY,MOVE], newName, {
            memory: {role: 'lorry', working: false}
        });
        return;
    }
}

function spawnProductionCreeps(spawn, counts, nbSources) {
    // En phase production, système complet
    
    // Maintenir les lorries (1 par miner)
    let nbLorries = counts.miners * CONFIG.lorryFactor;
    if (counts.lorries < nbLorries) {
        let newName = 'Lorry_' + Game.time;
        console.log('[PRODUCTION] Spawning lorry: ' + newName);
        spawn.spawnCreep([CARRY,MOVE,CARRY,MOVE], newName, {
            memory: {role: 'lorry', working: false}
        });
        return;
    }
    
    // Upgraders (priorité haute)
    if (counts.upgraders < CONFIG.upgraders) {
        let newName = 'Upgrader_' + Game.time;
        console.log('[PRODUCTION] Spawning upgrader: ' + newName);
        let upgradeBody = [MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY];
        spawn.spawnCreep(upgradeBody, newName, {
            memory: {role: 'upgrader', working: false}
        });
        return;
    }
    
    // Builders
    if (counts.builders < CONFIG.builders) {
        let newName = 'Builder_' + Game.time;
        console.log('[PRODUCTION] Spawning builder: ' + newName);
        spawn.spawnCreep([MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY], newName, {
            memory: {role: 'builder', working: false}
        });
        return;
    }
    
    // Long Distance Harvesters
    if (counts.longDistanceHarvesters < CONFIG.longDistanceHarvesters) {
        let newName = 'LDH_' + Game.time;
        console.log('[PRODUCTION] Spawning LDH: ' + newName);
        spawn.spawnCreep(
            [MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,ATTACK],
            newName,
            {memory: {role: 'longDistanceHarvester', home: 'E13S12', target: 'E12S12', sourceIndex: 0, working: false}}
        );
        return;
    }
}