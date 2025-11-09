// prototype.tower - Version simplifiée

const RepairManager = require('module.repairManager');

StructureTower.prototype.defend = function() {
    
    // 1. PRIORITÉ ABSOLUE: Défense
    let target = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    
    if (target != undefined) {
        this.attack(target);
        return;
    }
    
    // 2. Réparations (si >50% d'énergie)
    let energyPercent = this.store[RESOURCE_ENERGY] / this.store.getCapacity(RESOURCE_ENERGY);
    
    if (energyPercent > 0.5) {
        // Chercher structures critiques ou endommagées
        let target = RepairManager.findRepairTarget(this.room);
        
        if (target) {
            this.repair(target);
        }
    }
};