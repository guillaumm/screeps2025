# ✅ Checklist : Système de Réparation

## 📦 Nouveaux Fichiers à Créer

### 1. module.repairManager.js ⭐
- [ ] Créer le fichier
- [ ] Copier le contenu de l'artifact `screeps_repair_manager`
- [ ] **Fonctions :** `findRepairTarget`, `getRepairStats`, `needsRepair`, `generateRepairReport`

### 2. role.repairer.js ⭐
- [ ] Créer le fichier
- [ ] Copier le contenu de l'artifact `screeps_role_repairer`
- [ ] **Rôle dédié** aux réparations continues

---

## 🔄 Fichiers Existants à Modifier

### 3. role.builder.js
- [ ] **Remplacer** par le contenu de l'artifact `screeps_role_builder_complete`
- [ ] ✅ Importe `RepairManager`
- [ ] ✅ Répare automatiquement quand pas de construction
- [ ] ✅ Mémorise la cible de réparation

### 4. prototype.creep.js
- [ ] **Remplacer** par le contenu de l'artifact `screeps_prototype_creep_updated`
- [ ] ✅ Ajoute `repairer: require('role.repairer')` dans la liste des rôles

### 5. prototype.spawn.js
- [ ] **Modifier** la ligne 5
- [ ] ✅ Ajouter `'repairer'` dans `listOfRoles`
- [ ] Ligne avant : `['harvester','longDistanceHarvester', 'upgrader', 'lorry', 'builder', 'miner']`
- [ ] Ligne après : `['harvester','longDistanceHarvester', 'upgrader', 'lorry', 'builder', 'repairer', 'miner']`

### 6. config.orchestrator.js
- [ ] **Mettre à jour** les 3 phases (BOOTSTRAP, CONSTRUCTION, PRODUCTION)
- [ ] ✅ Ajouter `repairers: 0` (ou 1 en PRODUCTION)
- [ ] ✅ Ajouter dans `SPAWN_PRIORITY`: `repairers: 4`
- [ ] ✅ Commentaire dans `BODY_SIZE_MULTIPLIER`: "repairers" dans worker

### 7. main.js
- [ ] **Mettre à jour** `spawnWithOrchestrator()`
- [ ] ✅ Ajouter `repairers` dans `creepCounts`
- [ ] ✅ Ajouter `repairers` dans les logs de debug
- [ ] ✅ Ajouter check pour spawn des repairers dans `spawnNeeds`
- [ ] ✅ Ajouter case `'repairer'` dans `spawnCreepByRole()`

### 8. module.reporter.js
- [ ] **Mettre à jour** `reportPopulation()`
- [ ] ✅ Ajouter `repairers: 0` dans `creepCounts`
- [ ] ✅ Ajouter ligne d'affichage des repairers
- [ ] **Mettre à jour** `reportInfrastructure()`
- [ ] ✅ Ajouter `RepairManager.generateRepairReport(room)` à la fin

---

## 🧪 Tests à Effectuer

### Test 1 : Vérifier que ça compile
- [ ] Pas d'erreur au chargement
- [ ] Console affiche `[ORCHESTRATOR]` logs

### Test 2 : Builder répare automatiquement
- [ ] Builder spawné
- [ ] Aucun site de construction
- [ ] Builder va réparer une structure endommagée

### Test 3 : Repairer dédié (si configuré)
- [ ] Mettre `repairers: 1` dans PRODUCTION
- [ ] Attendre le spawn d'un repairer
- [ ] Repairer va vers une structure endommagée

### Test 4 : Rapport automatique
- [ ] Attendre le rapport (toutes les 5 minutes)
- [ ] Section "🔧 RÉPARATIONS" visible
- [ ] Statistiques correctes

### Test 5 : Priorisation
- [ ] Endommager plusieurs structures (via console ou attaque)
- [ ] Vérifier que le Spawn/Tours sont réparés en premier
- [ ] Puis Containers, puis Roads

---

## 🔍 Commandes Console Utiles (pour tester)

### Endommager une structure (test)
```javascript
// Trouver un container
let container = Game.spawns.Spawn1.room.find(FIND_STRUCTURES, {
    filter: s => s.structureType == STRUCTURE_CONTAINER
})[0];

// Voir ses HP
console.log(container.hits + '/' + container.hitsMax);

// Vous ne pouvez pas réduire les HP directement en simulation,
// mais le RepairManager considère < 75% comme endommagé
```

### Forcer un rapport immédiat
```javascript
const Reporter = require('module.reporter');
Reporter.generateReport(Game.spawns.Spawn1);
```

### Vérifier les stats de réparation
```javascript
const RepairManager = require('module.repairManager');
let stats = RepairManager.getRepairStats(Game.spawns.Spawn1.room);
console.log(JSON.stringify(stats, null, 2));
```

### Trouver les structures à réparer
```javascript
const RepairManager = require('module.repairManager');
let target = RepairManager.findRepairTarget(Game.spawns.Spawn1.room);
if (target) {
    console.log('Structure à réparer: ' + target.structureType);
    console.log('HP: ' + target.hits + '/' + target.hitsMax);
}
```

---

## 📊 Résultat Attendu

### Rapport Normal (tout va bien)
```
🔧 RÉPARATIONS:
  ✅ Toutes les structures en bon état
```

### Rapport avec Réparations Nécessaires
```
🔧 RÉPARATIONS:
  ⚠️  CRITIQUE: 1 structure(s)
  🔨 Endommagées: 3 structure(s)
  Détail:
    - container: 2/2 endommagées
    - road: 1/5 endommagées
```

### Population avec Repairers
```
👥 POPULATION DES CREEPS
----------------------------------------
  Harvesters:                0 / 0
  Miners:                    2 / auto
  Lorries:                   2 / auto
  Upgraders:                 4 / 4
  Builders:                  1 / 1
  Repairers:                 1 / 1    ← Nouveau !
  Long Distance Harv.:       2 / 2
  ──────────────────────────────────────
  TOTAL:                     12
```

---

## ⚠️ Points d'Attention

1. **Ordre d'import** : `RepairManager` doit être importé en haut de `role.builder.js` et `role.repairer.js`

2. **Mémoire des creeps** : `creep.memory.repairTarget` est utilisée pour mémoriser la cible

3. **Quotas par défaut** : 
   - BOOTSTRAP : `repairers: 0` (builders réparent)
   - CONSTRUCTION : `repairers: 0` (builders réparent)
   - PRODUCTION : `repairers: 1` (1 dédié)

4. **Priorité de spawn** : Les repairers sont en priorité 4 (après miners/lorries, avant upgraders)

---

## 🚀 Une Fois Terminé

- [ ] Tous les fichiers créés/modifiés
- [ ] Code compile sans erreur
- [ ] Builder répare automatiquement
- [ ] Rapport affiche les stats de réparation
- [ ] (Optionnel) Repairers dédiés fonctionnent

**Votre système de réparation est opérationnel ! 🎉**