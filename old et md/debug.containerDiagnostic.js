/*
Script de diagnostic pour les containers sources
Usage: require('debug.containerDiagnostic').run()
*/

const AutoContainerPlacer = require('module.autoContainerPlacer');
const ConstructionManager = require('module.constructionManager');
const MinerManager = require('module.minerManager');

module.exports = {
    run: function(roomName = null) {
        if (!roomName) {
            // Prendre la première room contrôlée
            for (let name in Game.rooms) {
                if (Game.rooms[name].controller && Game.rooms[name].controller.my) {
                    roomName = name;
                    break;
                }
            }
        }
        
        let room = Game.rooms[roomName];
        if (!room) {
            console.log('❌ Room introuvable: ' + roomName);
            return;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📦 DIAGNOSTIC CONTAINERS SOURCES - ' + roomName);
        console.log('='.repeat(60));
        
        // 1. Sources
        console.log('\n1️⃣ SOURCES:');
        let sources = room.find(FIND_SOURCES);
        console.log(`   Total: ${sources.length}`);
        
        for (let i = 0; i < sources.length; i++) {
            let source = sources[i];
            console.log(`\n   Source ${i + 1}: (${source.pos.x}, ${source.pos.y})`);
            console.log(`   ID: ${source.id}`);
            
            // Container existant
            let containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            if (containers.length > 0) {
                let c = containers[0];
                console.log(`   ✅ Container: (${c.pos.x}, ${c.pos.y})`);
                console.log(`      HP: ${c.hits}/${c.hitsMax} (${(c.hits/c.hitsMax*100).toFixed(0)}%)`);
                console.log(`      Energy: ${c.store[RESOURCE_ENERGY]}/${c.store.getCapacity(RESOURCE_ENERGY)}`);
            } else {
                console.log(`   ❌ Pas de container`);
                
                // Site de construction
                let sites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER
                });
                
                if (sites.length > 0) {
                    let s = sites[0];
                    console.log(`   🚧 Site: (${s.pos.x}, ${s.pos.y})`);
                    console.log(`      Progression: ${s.progress}/${s.progressTotal} (${(s.progress/s.progressTotal*100).toFixed(0)}%)`);
                } else {
                    console.log(`   ⚠️  Aucun site de construction`);
                    
                    // Trouver la meilleure position
                    let bestPos = AutoContainerPlacer.findBestContainerPosition(source);
                    if (bestPos) {
                        console.log(`   💡 Position suggérée: (${bestPos.x}, ${bestPos.y})`);
                        
                        // Afficher les positions autour de la source
                        console.log(`   🗺️  Carte des positions (distance 1):`);
                        let terrain = room.getTerrain();
                        for (let dy = -1; dy <= 1; dy++) {
                            let line = '      ';
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) {
                                    line += 'S '; // Source
                                    continue;
                                }
                                let x = source.pos.x + dx;
                                let y = source.pos.y + dy;
                                let pos = new RoomPosition(x, y, room.name);
                                
                                if (pos.x === bestPos.x && pos.y === bestPos.y) {
                                    line += '⭐'; // Meilleure position
                                } else if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                                    line += '🧱'; // Mur
                                } else if (terrain.get(x, y) === TERRAIN_MASK_SWAMP) {
                                    line += '🌿'; // Swamp
                                } else {
                                    line += '✅'; // Plain
                                }
                            }
                            console.log(line);
                        }
                    } else {
                        console.log(`   ❌ ERREUR: Aucune position valide trouvée !`);
                    }
                }
            }
            
            // Miner assigné
            let miner = _.find(Game.creeps, c => c.memory.role === 'miner' && c.memory.sourceId === source.id);
            if (miner) {
                console.log(`   👷 Miner: ${miner.name}`);
                console.log(`      Position: (${miner.pos.x}, ${miner.pos.y})`);
                console.log(`      TTL: ${miner.ticksToLive}`);
            } else {
                console.log(`   ❌ Pas de miner assigné`);
            }
        }
        
        // 2. Statistiques
        console.log('\n2️⃣ STATISTIQUES:');
        let missing = ConstructionManager.countMissingSourceContainers(room);
        console.log(`   Containers sources manquants: ${missing}`);
        
        let hasAll = ConstructionManager.hasAllSourceContainers(room);
        console.log(`   Tous construits: ${hasAll ? '✅' : '❌'}`);
        
        let minerCount = MinerManager.getMinerCount(room);
        let requiredMiners = MinerManager.getRequiredMinerCount(room);
        console.log(`   Miners: ${minerCount}/${requiredMiners}`);
        
        let canSpawnMiners = MinerManager.canSpawnMiners(room);
        console.log(`   Peut spawner miners: ${canSpawnMiners ? '✅' : '❌'}`);
        
        // 3. Sites de construction
        console.log('\n3️⃣ SITES DE CONSTRUCTION:');
        let allSites = room.find(FIND_CONSTRUCTION_SITES);
        console.log(`   Total: ${allSites.length}`);
        
        if (allSites.length > 0) {
            let prioritized = ConstructionManager.prioritizeConstructionSites(room, allSites);
            console.log('\n   Top 5 priorités:');
            for (let i = 0; i < Math.min(5, prioritized.length); i++) {
                let site = prioritized[i];
                let category = ConstructionManager.categorizeConstructionSite(site, sources);
                console.log(`   ${i+1}. ${category.type} en (${site.pos.x}, ${site.pos.y}) - ${(site.progress/site.progressTotal*100).toFixed(0)}%`);
            }
        }
        
        // 4. Builders
        console.log('\n4️⃣ BUILDERS:');
        let builders = _.filter(Game.creeps, c => c.memory.role === 'builder');
        console.log(`   Total: ${builders.length}`);
        let recommended = ConstructionManager.getRecommendedBuilderCount(room);
        console.log(`   Recommandés: ${recommended}`);
        
        if (builders.length > 0) {
            for (let builder of builders) {
                let target = 'Idle';
                if (builder.memory.constructionTarget) {
                    let site = Game.getObjectById(builder.memory.constructionTarget);
                    if (site) {
                        target = `${site.structureType} (${(site.progress/site.progressTotal*100).toFixed(0)}%)`;
                    }
                }
                console.log(`   - ${builder.name}: ${target}`);
            }
        }
        
        // 5. Actions disponibles
        console.log('\n5️⃣ ACTIONS DISPONIBLES:');
        if (missing > 0) {
            console.log('   💡 require("module.autoContainerPlacer").placeAllMissingContainers(Game.rooms["' + roomName + '"])');
        }
        if (builders.length < recommended) {
            console.log('   💡 Augmenter le quota de builders à ' + recommended);
        }
        if (allSites.length === 0 && missing > 0) {
            console.log('   ⚠️  PROBLÈME: Containers manquants mais aucun site de construction !');
            console.log('   💡 Activer autoPlaceSourceContainers dans config');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
    },
    
    /**
     * Affiche uniquement les informations sur les containers
     */
    quickCheck: function(roomName = null) {
        if (!roomName) {
            for (let name in Game.rooms) {
                if (Game.rooms[name].controller && Game.rooms[name].controller.my) {
                    roomName = name;
                    break;
                }
            }
        }
        
        console.log(AutoContainerPlacer.generateContainerReport(Game.rooms[roomName]));
    },
    
    /**
     * Force le placement immédiat dans toutes les rooms
     */
    forcePlaceAll: function() {
        console.log('\n🚀 PLACEMENT FORCÉ DE TOUS LES CONTAINERS\n');
        let totalPlaced = 0;
        
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                console.log(`📍 ${roomName}...`);
                let placed = AutoContainerPlacer.placeAllMissingContainers(room);
                totalPlaced += placed;
            }
        }
        
        console.log(`\n✅ Total placé: ${totalPlaced} container(s)\n`);
    }
};