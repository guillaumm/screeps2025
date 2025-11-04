// prototype.tower - Version refactorée avec configuration centralisée

const CONFIG = require('config.orchestrator');

// Créer une fonction pour StructureTower
StructureTower.prototype.defend = function() {
    
    // Chercher un creep hostile proche
    let target = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    
    // Si un ennemi est trouvé...
    if (target != undefined) {
        // ...FIRE!
        this.attack(target);
    }
    else {
        // Pas d'ennemi : vérifier si on doit réparer
        if (CONFIG.shouldTowerRepair(this)) {
            
            // Chercher une structure endommagée
            let damagedStructure = this.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => s.hits && s.hitsMax && s.hits < s.hitsMax
            });
            
            if (damagedStructure != undefined) {
                this.repair(damagedStructure);
            }
        }
    }
};