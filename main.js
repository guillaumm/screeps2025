/*
Spawn simplifié : 
- 1 seul type de worker polyvalent (remplace harvester/builder/upgrader/repairer)
- Miners et Lorries restent spécialisés
*/

function spawnWithOrchestrator(spawn) {
    if (spawn.spawning) return;
    
    let room = spawn.room;
    
    // Compter les creeps
    let workers = _.filter(Game.creeps, c => 
        c.room.name === room.name && 
        !['miner', 'lorry', 'longDistanceHarvester'].includes(c.memory.role)
    ).length;
    
    let miners = MinerManager.getMinerCount(room);
    let lorries = _.filter(Game.creeps, c => c.memory.role === 'lorry').length;
    let ldh = _.filter(Game.creeps, c => c.memory.role === 'longDistanceHarvester').length;
    
    // Déterminer la phase
    let phase = getPhase(miners, room);
    let quotas = CONFIG.getQuotasForPhase(phase);
    
    // Calculer les quotas
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
    
    // Priorités de spawn
    let spawnNeeds = [];
    
    // Workers polyvalents (priorité haute en early game)
    if (workers < workerQuota) {
        spawnNeeds.push({ type: 'worker', priority: phase === 'BOOTSTRAP' ? 1 : 3 });
    }
    
    // Miners
    if (miners < minerQuota && MinerManager.canSpawnMiners(room)) {
        spawnNeeds.push({ type: 'miner', priority: 2 });
    }
    
    // Lorries
    if (lorries < lorryQuota) {
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
    
    spawnCreep(spawn, need.type, phase);
}

function spawnCreep(spawn, type, phase) {
    let energy = phase === 'PRODUCTION' && CONFIG.ENERGY_CONFIG.useMaxEnergyInProduction
        ? spawn.room.energyCapacityAvailable
        : spawn.room.energyAvailable;
    
    let name = type.charAt(0).toUpperCase() + type.slice(1) + '_' + Game.time;
    let body, memory;
    
    switch(type) {
        case 'worker':
            // Worker polyvalent : pattern [WORK, CARRY, MOVE]
            body = getAdaptiveBody(energy, 'worker', phase);
            memory = { role: 'worker', currentTask: null }; // Pas de rôle fixe !
            break;
            
        case 'miner':
            let assignment = MinerManager.getNextMinerAssignment(spawn.room);
            if (!assignment) return;
            
            body = MinerManager.createMinerBody(energy, CONFIG.BODY_SIZE_MULTIPLIER.miner || 1.0);
            memory = {
                role: 'miner',
                sourceId: assignment.sourceId,
                linkId: assignment.linkId
            };
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
        console.log(`[${phase}] ✅ Spawning ${type}: ${name}`);
    }
}

// Reste identique...
function getAdaptiveBody(energy, type, phase) {
    let multiplier = CONFIG.BODY_SIZE_MULTIPLIER[type] || 1.0;
    
    if (type === 'worker') {
        if (energy < 200) return [WORK, CARRY, MOVE];
        
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
        if (energy < 150) return [CARRY, MOVE];
        
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