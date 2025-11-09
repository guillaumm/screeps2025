/*
Module de visualisation - Affiche les optimisations géographiques
📍 Montre les relais énergétiques, zones d'activité, trajets optimisés
*/

const CONFIG = require('config.orchestrator');

module.exports = {
    
    /**
     * Visualise toutes les optimisations pour une room
     * @param {Room} room - La room à visualiser
     */
    visualizeRoom: function(room) {
        if (!CONFIG.DEBUG_MODE) return;  // Seulement en mode debug
        
        this.visualizeEnergyRelays(room);
        this.visualizeWorkerTasks(room);
        this.visualizeActivityZones(room);
    },
    
    /**
     * Affiche les relais énergétiques disponibles
     */
    visualizeEnergyRelays: function(room) {
        let visual = room.visual;
        
        // Containers (sources d'énergie)
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] > 200
        });
        
        for (let container of containers) {
            let percent = (container.store[RESOURCE_ENERGY] / container.store.getCapacity(RESOURCE_ENERGY) * 100).toFixed(0);
            visual.circle(container.pos, {
                radius: 0.5,
                fill: 'transparent',
                stroke: '#ffaa00',
                strokeWidth: 0.15
            });
            visual.text(`⚡${percent}%`, container.pos.x, container.pos.y + 0.8, {
                color: '#ffaa00',
                font: 0.4
            });
        }
        
        // Storage
        if (room.storage && room.storage.store[RESOURCE_ENERGY] > 500) {
            let percent = (room.storage.store[RESOURCE_ENERGY] / room.storage.store.getCapacity() * 100).toFixed(0);
            visual.circle(room.storage.pos, {
                radius: 0.7,
                fill: 'transparent',
                stroke: '#00ff00',
                strokeWidth: 0.2
            });
            visual.text(`💰${percent}%`, room.storage.pos.x, room.storage.pos.y - 1, {
                color: '#00ff00',
                font: 0.5
            });
        }
    },
    
    /**
     * Affiche les tâches des workers avec couleurs
     */
    visualizeWorkerTasks: function(room) {
        let visual = room.visual;
        
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            if (creep.room.name !== room.name) continue;
            if (['miner', 'lorry', 'longDistanceHarvester'].includes(creep.memory.role)) continue;
            
            let task = creep.memory.currentTask;
            let target = Game.getObjectById(creep.memory.taskTarget);
            
            if (task && target) {
                let color = this.getTaskColor(task);
                
                // Ligne entre creep et target
                visual.line(creep.pos, target.pos, {
                    color: color,
                    width: 0.1,
                    opacity: 0.3,
                    lineStyle: 'dashed'
                });
                
                // Point sur le target
                visual.circle(target.pos, {
                    radius: 0.3,
                    fill: color,
                    opacity: 0.5
                });
            }
            
            // Si utilise un relais, le montrer
            if (creep.memory.harvestMode === 'relay' && creep.memory.pausedTarget) {
                let pausedTarget = Game.getObjectById(creep.memory.pausedTarget);
                if (pausedTarget) {
                    visual.line(creep.pos, pausedTarget.pos, {
                        color: '#ff00ff',
                        width: 0.15,
                        opacity: 0.5,
                        lineStyle: 'dotted'
                    });
                    visual.text('🔄', creep.pos.x, creep.pos.y - 0.5, {
                        color: '#ff00ff',
                        font: 0.4
                    });
                }
            }
        }
    },
    
    /**
     * Affiche les zones d'activité (heatmap simplifié)
     */
    visualizeActivityZones: function(room) {
        let visual = room.visual;
        
        // Zone controller (upgrade)
        if (room.controller) {
            visual.circle(room.controller.pos, {
                radius: 3,
                fill: 'transparent',
                stroke: '#ff00ff',
                strokeWidth: 0.1,
                opacity: 0.3
            });
        }
        
        // Zones de construction
        let sites = room.find(FIND_CONSTRUCTION_SITES);
        for (let site of sites) {
            visual.circle(site.pos, {
                radius: 1.5,
                fill: 'transparent',
                stroke: '#ffffff',
                strokeWidth: 0.1,
                opacity: 0.2
            });
        }
    },
    
    /**
     * Affiche des statistiques en overlay
     */
    displayRoomStats: function(room) {
        let visual = room.visual;
        let TaskManager = require('module.taskManager');
        let stats = TaskManager.getTaskStats(room);
        
        let y = 1;
        let x = 1;
        
        // Politique active
        let policy = CONFIG.getActivePolicy();
        visual.text(`📍 ${policy.name}`, x, y, {
            color: '#00ff00',
            font: 0.6,
            align: 'left'
        });
        y += 1;
        
        // Distribution des tâches
        visual.text(`Workers: ${stats.total}`, x, y, {
            color: '#ffffff',
            font: 0.5,
            align: 'left'
        });
        y += 0.7;
        
        if (stats.total > 0) {
            visual.text(`⛏️ ${stats.harvest} 📦 ${stats.transfer} 🔨 ${stats.build}`, x, y, {
                color: '#ffaa00',
                font: 0.5,
                align: 'left'
            });
            y += 0.7;
            
            visual.text(`🔧 ${stats.repair} ⚡ ${stats.upgrade}`, x, y, {
                color: '#ffaa00',
                font: 0.5,
                align: 'left'
            });
            y += 0.7;
            
            if (stats.usingRelays > 0) {
                visual.text(`🔄 Relays: ${stats.usingRelays}`, x, y, {
                    color: '#ff00ff',
                    font: 0.5,
                    align: 'left'
                });
            }
        }
    },
    
    /**
     * Couleur selon type de tâche
     */
    getTaskColor: function(task) {
        const COLORS = {
            'harvest': '#ffaa00',
            'build': '#ffffff',
            'repair': '#00ff00',
            'upgrade': '#ff00ff',
            'transfer': '#0000ff'
        };
        return COLORS[task] || '#888888';
    },
    
    /**
     * Visualise le trajet optimisé d'un creep vers sa cible
     */
    visualizeOptimizedPath: function(creep, target) {
        if (!target) return;
        
        let visual = creep.room.visual;
        let path = creep.pos.findPathTo(target);
        
        if (path.length > 0) {
            // Dessiner le chemin
            for (let i = 0; i < path.length - 1; i++) {
                let current = new RoomPosition(path[i].x, path[i].y, creep.room.name);
                let next = new RoomPosition(path[i + 1].x, path[i + 1].y, creep.room.name);
                
                visual.line(current, next, {
                    color: '#00ffff',
                    width: 0.15,
                    opacity: 0.5
                });
            }
            
            // Distance totale
            visual.text(`${path.length}`, target.x, target.y + 1, {
                color: '#00ffff',
                font: 0.4
            });
        }
    }
};