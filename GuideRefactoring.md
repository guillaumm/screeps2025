# 🎛️ Guide de Refactoring - Configuration Centralisée

## 📋 Vue d'ensemble

Ce refactoring regroupe **tous les réglages manuels** dispersés dans votre code vers un fichier central : `config.orchestrator.js`.

---

## 🔍 Anciennes "Manettes" Identifiées

### 1. **prototype.creep.js**
```javascript
// ❌ AVANT : Logique hardcodée
if (this.memory.role=='upgrader') {
    let linkList = _.filter(Game.structures, s => s.structureType == STRUCTURE_LINK);
    let linkTo = linkList[1];  // Index hardcodé !
    // ...
}
```

```javascript
// ✅ APRÈS : Configuration
upgraderLinkIndex: 1  // Dans config.orchestrator
```

---

### 2. **role.builder.js / role.upgrader.js / role.repairer.js**
```javascript
// ❌ AVANT : Code dupliqué 3 fois
let miners = _.filter(Game.creeps, (c) => c.memory.role == 'miner');
let nbSources = creep.room.find(FIND_SOURCES).length;

if (miners.length >= nbSources) {
    creep.getEnergy(true, false);
} else {
    creep.getEnergy(true, true);
}
```

```javascript
// ✅ APRÈS : Une ligne
let useSource = CONFIG.shouldUseSourcesDirectly(creep, creep.room);
creep.getEnergy(true, useSource);
```

---

### 3. **prototype.tower.js**
```javascript
// ❌ AVANT : Condition hardcodée
if (miners.length >= nbSources) {
    // Réparer
}
```

```javascript
// ✅ APRÈS : Configuration
if (CONFIG.shouldTowerRepair(this)) {
    // Réparer
}
```

---

### 4. **role.lorry.js**
```javascript
// ❌ AVANT : Link commenté manuellement
filter: (s) => (s.structureType == STRUCTURE_SPAWN
             || s.structureType == STRUCTURE_EXTENSION
             //|| s.structureType == STRUCTURE_LINK  // <-- À décommenter manuellement
             || s.structureType == STRUCTURE_STORAGE
```

```javascript
// ✅ APRÈS : Manette
lorriesDepositToLinks: false  // Dans config.orchestrator
```

---

### 5. **main.js**
```javascript
// ❌ AVANT : Seuil unique pour toutes les phases
if (!CONFIG.hasEnoughEnergyToSpawn(spawn.room) && phase !== 'BOOTSTRAP') {
    return;
}
```

```javascript
// ✅ APRÈS : Seuils par phase
minPercentForSpawn: {
    BOOTSTRAP: 0.0,      // Toujours spawn
    CONSTRUCTION: 0.3,   // 30% minimum
    PRODUCTION: 0.5      // 50% minimum
}
```

---

### 6. **module.minerManager.js**
```javascript
// ❌ AVANT : Limites hardcodées
workParts = Math.max(3, Math.min(workParts, 20));
```

```javascript
// ✅ APRÈS : Configuration
MINER_CONFIG: {
    minWorkParts: 3,
    maxWorkParts: 20
}
```

---

## 🎯 Nouvelle Structure de Configuration

### `config.orchestrator.js` contient maintenant :

#### 1. **CREEP_BEHAVIOR** - Comportement des creeps
```javascript
CREEP_BEHAVIOR: {
    workersUseSourcesWhenNoMiners: true,    // Workers récoltent aux sources si pas de miners
    harvestersAlwaysUseSources: true,        // Harvesters = backup
    upgradersUseDedicatedLink: true,         // Upgraders utilisent un link dédié
    upgraderLinkIndex: 1,                    // Index du link upgrader
    lorriesDepositToLinks: false,            // Lorries déposent dans links ?
    lorriesPickupDroppedEnergy: true,        // Lorries ramassent énergie tombée
    lorriesLootTombstones: true,             // Lorries pillent tombes
    lorryMinContainerEnergy: 100             // Seuil minimum pour récolter
}
```

#### 2. **TOWER_BEHAVIOR** - Comportement des tours
```javascript
TOWER_BEHAVIOR: {
    repairOnlyWithMiners: true,              // Tours réparent uniquement avec miners
    minEnergyPercentToRepair: 0.5            // 50% minimum d'énergie pour réparer
}
```

#### 3. **MINER_CONFIG** - Configuration des miners
```javascript
MINER_CONFIG: {
    minWorkParts: 3,                         // Minimum WORK parts
    maxWorkParts: 20,                        // Maximum WORK parts
    maxContainerRange: 2,                    // Distance max source-container
    useLinksIfAvailable: true                // Utiliser links si disponibles
}
```

#### 4. **REPAIR_CONFIG** - Système de réparation
```javascript
REPAIR_CONFIG: {
    criticalThreshold: 0.25,                 // < 25% = critique
    damagedThreshold: 0.75,                  // < 75% = endommagé
    maxWallHits: 50000,                      // HP max walls/ramparts
    buildersAutoRepair: true                 // Builders réparent auto
}
```

#### 5. **ENERGY_CONFIG** - Gestion de l'énergie
```javascript
ENERGY_CONFIG: {
    minPercentForSpawn: {
        BOOTSTRAP: 0.0,                      // Toujours spawn
        CONSTRUCTION: 0.3,                   // 30% minimum
        PRODUCTION: 0.5                      // 50% minimum
    },
    useMaxEnergyInProduction: true,          // Utiliser capacité max en production
    minContainerEnergy: 100                  // Énergie min dans container
}
```

---

## 🔧 Nouvelles Méthodes Helper

### 1. `CONFIG.shouldUseSourcesDirectly(creep, room)`
Détermine si un creep doit récolter aux sources directement.

### 2. `CONFIG.shouldTowerRepair(tower)`
Vérifie si une tour doit réparer (énergie + miners).

### 3. `CONFIG.getUpgraderLink(room)`
Retourne le link dédié aux upgraders s'il existe.

### 4. `CONFIG.getLorryDepositTargets()`
Retourne la liste des structures où les lorries déposent.

### 5. `CONFIG.hasEnoughEnergyToSpawn(room, phase)`
Vérifie le seuil d'énergie selon la phase.

### 6. `CONFIG.hasEnoughMiners(room)`
Vérifie si on a assez de miners pour l'économie avancée.

---

## 📦 Fichiers à Remplacer

### ✅ Obligatoires
1. **config.orchestrator.js** - Nouvelle version avec toutes les manettes
2. **prototype.creep.js** - Refactoré avec CONFIG
3. **prototype.tower.js** - Refactoré avec CONFIG
4. **main.js** - Seuils d'énergie par phase

### ✅ Recommandés
5. **role.builder.js** - Utilise `shouldUseSourcesDirectly()`
6. **role.upgrader.js** - Utilise `shouldUseSourcesDirectly()`
7. **role.repairer.js** - Utilise `shouldUseSourcesDirectly()`
8. **role.lorry.js** - Utilise `getLorryDepositTargets()`

---

## 🎮 Exemples d'Utilisation

### Désactiver les upgraders avec link
```javascript
CREEP_BEHAVIOR: {
    upgradersUseDedicatedLink: false  // Plus de link upgrader
}
```

### Lorries déposent dans les links
```javascript
CREEP_BEHAVIOR: {
    lorriesDepositToLinks: true  // Maintenant ils déposent dans links
}
```

### Tours plus agressives sur les réparations
```javascript
TOWER_BEHAVIOR: {
    repairOnlyWithMiners: false,        // Réparent toujours
    minEnergyPercentToRepair: 0.3       // Dès 30% d'énergie
}
```

### Miners plus petits pour économiser
```javascript
MINER_CONFIG: {
    maxWorkParts: 10  // Au lieu de 20
}
```

### Spawn plus agressif en CONSTRUCTION
```javascript
ENERGY_CONFIG: {
    minPercentForSpawn: {
        BOOTSTRAP: 0.0,
        CONSTRUCTION: 0.2,   // 20% au lieu de 30%
        PRODUCTION: 0.5
    }
}
```

---

## ⚠️ Points d'Attention

### 1. **Ordre d'import**
Assurez-vous que `config.orchestrator` est importé en haut des fichiers :
```javascript
const CONFIG = require('config.orchestrator');
```

### 2. **Index du link upgrader**
Si vous changez `upgraderLinkIndex`, vérifiez que :
- Le link existe à cet index
- Il est bien à portée du controller

### 3. **Seuils d'énergie**
Les seuils trop bas en PRODUCTION peuvent ralentir les spawns de gros creeps.

### 4. **Compatibilité**
Les anciennes versions de vos rôles continueront de fonctionner, mais sans profiter de la configuration centralisée.

---

## 🚀 Migration Progressive

### Étape 1 : Backup
Sauvegardez votre code actuel.

### Étape 2 : Config
Remplacez `config.orchestrator.js` par la nouvelle version.

### Étape 3 : Core
Remplacez `prototype.creep.js`, `prototype.tower.js`, `main.js`.

### Étape 4 : Roles (optionnel)
Remplacez les rôles un par un et testez.

### Étape 5 : Test
Vérifiez que tout fonctionne comme avant, puis ajustez les manettes !

---

## 📊 Bénéfices

### ✅ Avant
- 6 fichiers avec logique hardcodée
- Code dupliqué 3 fois (workers)
- Modifications nécessitent éditer plusieurs fichiers
- Difficile de tester différentes configurations

### ✅ Après
- **1 seul fichier** pour tout configurer
- Aucune duplication
- Modifications instantanées
- Facile de créer des "profiles" de configuration

---

## 🎉 Conclusion

Tous vos réglages sont maintenant dans **`config.orchestrator.js`**.

Plus besoin de commenter/décommenter du code ou de chercher les constantes magiques !

**Bon gaming ! 🎮**