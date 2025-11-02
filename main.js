/*
Version refactorisée avec système de phases de démarrage
+ Orchestrateur configurable
+ Système de rapport automatique
*/

// Import modules
require('prototype.creep');
require('prototype.tower');
require('prototype.spawn');
require('prototype.link');

// Import nouveaux modules
const CONFIG = require('config.orchestrator');
const Reporter = require('module.reporter');

module.exports.loop = function() {
    
    // Récupérer le spawn principal
    let mainSpawn = Game.spawns[Object.keys(Game.spawns)[0]];
    
    // ========== RAPPORT PÉRIODIQUE ==========
    if (Game.time % CONFIG.REPORT_INTERVAL == 0) {
        Reporter.generateReport(mainSpawn);
    }
    
    // Gestion du CPU bucket
    if(Game.cpu.bucket > 9000) {
        Game.cpu.generatePixel();
    }
    
    // Initialisation mémoire
    if(!Memory.niveaux) {
        Memory.niveaux = [""];
    }
    
    // Log périodique des niveaux d'énergie (gardé pour compatibilité)
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

    // ========== SYSTÈME DE SPAWN ==========
    
    if (CONFIG.USE_MANUAL_SPAWN) {
        // Mode manuel : spawn via main.js avec orchestrateur
        spawnWithOrchestrator(mainSpawn);
    } else {
        // Mode automatique : spawn via prototype.spawn
        for (let spawnName in Game.spawns) {
            Game.spawns[spawnName].spawnCreepsIfNecessary();
        }
    }
};

// ========== FONCTION DE SPAWN ORCHESTRÉE ==========

function spawnWithOrchestrator(spawn) {
    
    // Comptage des creeps par rôle
    let creepCounts = {
        harvesters: _.filter(Game.creeps, c => c.memory.role == 'harvester').length,
        upgraders: _.filter(Game.creeps, c => c.memory.role == 'upgrader').length,
        builders: _.filter(Game.creeps, c => c.memory.role == 'builder').length,
        miners: _.filter(Game.creeps, c => c.memory.role == 'miner').length,
        lorries: _.filter(Game.creeps, c => c.memory.role == 'lorry').length,
        longDistanceHarvesters: _.sum(Game.creeps, c => 
            c.memory.role == 'longDistanceHarvester' && c.memory.target == CONFIG.TARGET_ROOM
        )
    };
    
    // Détection de l'état de la base
    let nbSources = spawn.room.find(FIND_SOURCES).length;
    let containers = spawn.room.find(FIND_STRUCTURES, {
        filter: s => s.structureType == STRUCTURE_CONTAINER
    });
    let constructionSites = spawn.room.find(FIND_CONSTRUCTION_SITES);
    
    // Déterminer la phase actuelle
    let phase = getPhase(creepCounts.miners, nbSources, containers.length, constructionSites.length);
    
    // Récupérer les quotas configurés pour cette phase
    let quotas = CONFIG.getQuotasForPhase(phase);
    
    // Log de la phase (debug)
    if (Game.time % 100 == 0) {
        console.log("=== Phase actuelle: " + phase + " ===");
        console.log("Miners: " + creepCounts.miners + "/" + nbSources);
        console.log("Containers: " + containers.length);
        console.log("Sites de construction: " + constructionSites.length);
    }
    
    // Vérifier si on a assez d'énergie pour spawn
    if (!CONFIG.hasEnoughEnergyToSpawn(spawn.room) && phase !== 'BOOTSTRAP') {
        return; // Attendre d'avoir plus d'énergie (sauf en bootstrap où on est pauvre)
    }
    
    // Créer une liste de besoins avec priorités
    let spawnNeeds = [];
    
    // Calculer les quotas dynamiques
    let lorryQuota = quotas.lorries === 'auto' 
        ? CONFIG.calculateLorryCount(creepCounts.miners)
        : quotas.lorries;
    
    let minerQuota = quotas.miners === 'auto'
        ? nbSources
        : quotas.miners;
    
    // Ajouter les besoins à la liste
    if (creepCounts.harvesters < quotas.harvesters) {
        spawnNeeds.push({ role: 'harvester', priority: CONFIG.SPAWN_PRIORITY.harvesters });
    }
    if (creepCounts.miners < minerQuota) {
        spawnNeeds.push({ role: 'miner', priority: CONFIG.SPAWN_PRIORITY.miners });
    }
    if (creepCounts.lorries < lorryQuota) {
        spawnNeeds.push({ role: 'lorry', priority: CONFIG.SPAWN_PRIORITY.lorries });
    }
    if (creepCounts.upgraders < quotas.upgraders) {
        spawnNeeds.push({ role: 'upgrader', priority: CONFIG.SPAWN_PRIORITY.upgraders });
    }
    if (creepCounts.builders < quotas.builders) {
        spawnNeeds.push({ role: 'builder', priority: CONFIG.SPAWN_PRIORITY.builders });
    }
    if (creepCounts.longDistanceHarvesters < quotas.longDistanceHarvesters) {
        spawnNeeds.push({ role: 'longDistanceHarvester', priority: CONFIG.SPAWN_PRIORITY.longDistanceHarvesters });
    }
    
    // Trier par priorité (plus petit = plus prioritaire)
    spawnNeeds.sort((a, b) => a.priority - b.priority);
    
    // Spawn le creep le plus prioritaire
    if (spawnNeeds.length > 0) {
        let need = spawnNeeds[0];
        spawnCreepByRole(spawn, need.role, phase);
    }
}

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

// ========== FONCTION DE CRÉATION DE CORPS ADAPTATIF ==========

function getAdaptiveBody(energy, type, phase) {
    // Appliquer le multiplicateur de taille depuis la config
    let multiplier = CONFIG.BODY_SIZE_MULTIPLIER[type] || 1.0;
    
    // Utiliser energyCapacity en production si configuré
    if (phase === 'PRODUCTION' && CONFIG.USE_MAX_ENERGY_IN_PRODUCTION) {
        // On utilisera energyCapacityAvailable dans spawnCreepByRole
    }
    
    if (type == 'worker') {
        // Pour builder, upgrader, harvester : pattern [WORK, CARRY, MOVE]
        // Coût : 200 par unité
        if (energy < 200) return [WORK, CARRY, MOVE]; // Minimum
        
        let units = Math.floor(energy / 200);
        units = Math.floor(units * multiplier);
        units = Math.min(units, 16); // Max 16 unités = 48 parts
        
        let body = [];
        for (let i = 0; i < units; i++) {
            body.push(WORK, CARRY, MOVE);
        }
        return body;
    }
    
    if (type == 'lorry') {
        // Pour lorry : pattern [CARRY, CARRY, MOVE]
        // Coût : 150 par unité
        if (energy < 150) return [CARRY, MOVE]; // Minimum
        
        let units = Math.floor(energy / 150);
        units = Math.floor(units * multiplier);
        units = Math.min(units, 16); // Max 16 unités = 48 parts
        
        let body = [];
        for (let i = 0; i < units; i++) {
            body.push(CARRY, CARRY, MOVE);
        }
        return body;
    }
    
    // Par défaut
    return [WORK, CARRY, MOVE];
}

// ========== FONCTION DE SPAWN PAR RÔLE ==========

function spawnCreepByRole(spawn, role, phase) {
    let newName = role.charAt(0).toUpperCase() + role.slice(1) + '_' + Game.time;
    let body;
    let memory;
    
    // Déterminer l'énergie disponible
    let availableEnergy = spawn.room.energyAvailable;
    if (phase === 'PRODUCTION' && CONFIG.USE_MAX_ENERGY_IN_PRODUCTION) {
        availableEnergy = spawn.room.energyCapacityAvailable;
    }
    
    switch(role) {
        case 'harvester':
            body = getAdaptiveBody(availableEnergy, 'worker', phase);
            memory = { role: 'harvester', working: false };
            break;
            
        case 'upgrader':
            body = getAdaptiveBody(availableEnergy, 'worker', phase);
            memory = { role: 'upgrader', working: false };
            break;
            
        case 'builder':
            body = getAdaptiveBody(availableEnergy, 'worker', phase);
            memory = { role: 'builder', working: false };
            break;
            
        case 'lorry':
            body = getAdaptiveBody(availableEnergy, 'lorry', phase);
            memory = { role: 'lorry', working: false };
            break;
            
        case 'miner':
            // Les miners sont gérés par prototype.spawn pour l'assignation aux sources
            // On ne les spawn pas ici pour éviter les conflits
            console.log('[ORCHESTRATOR] Miner spawn délégué à prototype.spawn');
            return;
            
        case 'longDistanceHarvester':
            // Body spécial avec ATTACK
            body = [MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,ATTACK];
            if (availableEnergy < 1250) {
                body = getAdaptiveBody(availableEnergy, 'worker', phase);
                body.push(ATTACK);
            }
            memory = {
                role: 'longDistanceHarvester',
                home: CONFIG.HOME_ROOM,
                target: CONFIG.TARGET_ROOM,
                sourceIndex: 0,
                working: false
            };
            break;
            
        default:
            console.log('[ORCHESTRATOR] Rôle inconnu: ' + role);
            return;
    }
    
    // Spawn le creep
    let result = spawn.spawnCreep(body, newName, { memory: memory });
    
    if (result == OK) {
        console.log(`[${phase}] Spawning ${role}: ${newName}`);
    }
}