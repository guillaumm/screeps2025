/*
Module de diagnostic pour les miners
À appeler depuis main.js avec : require('debug.minerDiagnostic').run();
*/

const MinerManager = require('module.minerManager');
const CONFIG = require('config.orchestrator');

module.exports = {
    run: function() {
        let spawn = Game.spawns[Object.keys(Game.spawns)[0]];
        let room = spawn.room;
        
        console.log('\n========== DIAGNOSTIC MINERS ==========');
        
        // 1. Configuration
        console.log('\n1. CONFIG:');
        console.log('  USE_MANUAL_SPAWN:', CONFIG.USE_MANUAL_SPAWN);
        
        // 2. Sources et containers
        console.log('\n2. SOURCES:');
        let sources = room.find(FIND_SOURCES);
        for (let i = 0; i < sources.length; i++) {
            let source = sources[i];
            console.log('  Source ' + (i+1) + ':', source.id);
            
            let containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: s => s.structureType == STRUCTURE_CONTAINER
            });
            console.log('    Containers:', containers.length);
            if (containers.length > 0) {
                console.log('    Distance:', source.pos.getRangeTo(containers[0]));
            }
        }
        
        // 3. Miners actuels
        console.log('\n3. MINERS ACTUELS:');
        let miners = _.filter(Game.creeps, c => c.memory.role == 'miner');
        console.log('  Total:', miners.length);
        for (let miner of miners) {
            console.log('  -', miner.name, '-> source:', miner.memory.sourceId);
        }
        
        // 4. MinerManager
        console.log('\n4. MINER MANAGER:');
        console.log('  getMinerCount:', MinerManager.getMinerCount(room));
        console.log('  getRequiredMinerCount:', MinerManager.getRequiredMinerCount(room));
        console.log('  canSpawnMiners:', MinerManager.canSpawnMiners(room));
        
        // 5. Besoins
        console.log('\n5. BESOINS:');
        let needs = MinerManager.analyzeMinerNeeds(room);
        console.log('  Besoins détectés:', needs.length);
        for (let i = 0; i < needs.length; i++) {
            console.log('  Besoin ' + (i+1) + ':');
            console.log('    hasContainer:', needs[i].hasContainer);
            console.log('    sourceId:', needs[i].sourceId);
        }
        
        // 6. Assignation
        console.log('\n6. ASSIGNATION:');
        let assignment = MinerManager.getNextMinerAssignment(room);
        if (assignment) {
            console.log('  ✅ Disponible');
            console.log('    sourceId:', assignment.sourceId);
        } else {
            console.log('  ❌ Aucune');
        }
        
        // 7. Énergie
        console.log('\n7. ÉNERGIE:');
        console.log('  Available:', room.energyAvailable);
        console.log('  Capacity:', room.energyCapacityAvailable);
        console.log('  Enough?', CONFIG.hasEnoughEnergyToSpawn(room));
        
        // 8. Phase
        console.log('\n8. PHASE:');
        let minerCount = MinerManager.getMinerCount(room);
        let nbSources = sources.length;
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER
        });
        
        let phase = 'UNKNOWN';
        if (minerCount == 0) {
            phase = 'BOOTSTRAP';
        } else if (minerCount < nbSources || containers.length < nbSources) {
            phase = 'CONSTRUCTION';
        } else {
            phase = 'PRODUCTION';
        }
        console.log('  Phase:', phase);
        
        let quotas = CONFIG.getQuotasForPhase(phase);
        console.log('  Quota miners:', quotas.miners);
        
        // 9. Spawn
        console.log('\n9. SPAWN:');
        if (spawn.spawning) {
            console.log('  En cours:', spawn.spawning.name);
            console.log('  Temps restant:', spawn.spawning.remainingTime);
        } else {
            console.log('  Libre');
        }
        
        console.log('\n========================================\n');
    }
};