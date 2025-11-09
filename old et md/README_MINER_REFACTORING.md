# 🔧 Refactoring du Système de Miners

## 🎯 Objectifs du Refactoring

1. **Centraliser** la logique des miners dans un module dédié
2. **Éliminer** la duplication de code entre main.js et prototype.spawn.js
3. **Faciliter** l'évolution future avec un orchestrateur intelligent
4. **Améliorer** la visibilité sur l'état des miners

---

## 📁 Nouveau Module : module.minerManager.js

### Responsabilités

Le **MinerManager** gère tout ce qui concerne les miners :

- ✅ **Analyse des besoins** : Quelles sources ont besoin d'un miner ?
- ✅ **Détection des containers** : Un miner ne peut être créé que si un container existe
- ✅ **Détection des links** : Assignation automatique d'un link proche
- ✅ **Assignation intelligente** : Assure qu'un miner est assigné à UNE source spécifique
- ✅ **Création du corps** : Corps adaptatif selon l'énergie disponible
- ✅ **Rapport détaillé** : État de chaque source et de son miner assigné

---

## 🔄 Architecture du Système

### Avant (Problèmes)

```
main.js ──────────┐
                  ├──> Logique de miners DUPLIQUÉE
prototype.spawn ──┘
```

**Problèmes :**
- Code dupliqué
- Difficile de changer la logique
- Pas de vue d'ensemble

### Après (Centralisé)

```
                    module.minerManager.js
                           │
              ┌────────────┴────────────┐
              │                         │
          main.js              prototype.spawn.js
     (orchestrateur)          (mode automatique)
```

**Avantages :**
- Une seule source de vérité
- Facile à maintenir
- Vue d'ensemble claire

---

## 🎮 Utilisation du MinerManager

### 1. Obtenir le nombre de miners nécessaires

```javascript
const MinerManager = require('module.minerManager');

// Nombre actuel de miners dans une room
let minerCount = MinerManager.getMinerCount(room);

// Nombre requis (sources avec container)
let requiredMiners = MinerManager.getRequiredMinerCount(room);

console.log(`Miners: ${minerCount} / ${requiredMiners}`);
```

### 2. Vérifier si on peut créer des miners

```javascript
// Vérifie qu'au moins 1 source a un container
if (MinerManager.canSpawnMiners(room)) {
    console.log("On peut créer des miners !");
}

// Vérifie si tous les miners nécessaires existent
if (MinerManager.hasAllMiners(room)) {
    console.log("Tous les miners sont en place !");
}
```

### 3. Créer un miner

```javascript
// Récupérer l'assignation pour le prochain miner
let assignment = MinerManager.getNextMinerAssignment(room);

if (assignment) {
    console.log("Source à miner:", assignment.sourceId);
    console.log("Container:", assignment.containerId);
    console.log("Link:", assignment.linkId); // peut être null
    
    // Créer le corps du miner
    let body = MinerManager.createMinerBody(
        spawn.room.energyAvailable,
        1.0  // multiplicateur de taille
    );
    
    // Spawner le miner
    spawn.spawnCreep(body, 'miner_' + Game.time, {
        memory: {
            role: 'miner',
            sourceId: assignment.sourceId,
            linkId: assignment.linkId
        }
    });
}
```

### 4. Générer un rapport

```javascript
// Rapport détaillé sur l'état des miners
let report = MinerManager.generateMinerReport(room);
console.log(report);
```

**Exemple de sortie :**

```
  📍 ASSIGNATION DES MINERS:
    Source 1: ✅ Miner_12345
      └─ Link disponible
    Source 2: ⚠️  Besoin d'un miner
```

---

## 🏗️ Corps des Miners

### Formule Adaptative

Le MinerManager crée des corps intelligents selon l'énergie :

```javascript
// Minimum (350 energy)
[WORK, WORK, WORK, CARRY, MOVE]

// Standard (550 energy)
[WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE]

// Avec plus d'énergie (850 energy)
[WORK x8, CARRY, MOVE, MOVE]

// Maximum (2100 energy = 20 WORK parts)
[WORK x20, CARRY, MOVE, MOVE]
```

### Pourquoi ce design ?

- **5+ WORK parts** : Mine efficacement n'importe quelle source
- **1 CARRY part** : Permet de transférer vers un link
- **2 MOVE parts** : Peut se déplacer même chargé
- **Max 20 WORK** : Au-delà, c'est du gaspillage (source max = 3000 energy)

---

## 🔧 Intégration avec l'Orchestrateur

### Quotas Automatiques

Dans `config.orchestrator.js` :

```javascript
PRODUCTION: {
    miners: 'auto',  // Utilise MinerManager.getRequiredMinerCount()
    // ...
}
```

### Multiplicateur de Taille

```javascript
BODY_SIZE_MULTIPLIER: {
    miner: 1.5,  // Miners 50% plus gros
    // ...
}
```

Le MinerManager respectera ce multiplicateur lors de la création du corps.

---

## 📊 Rapport Enrichi

Le rapport périodique affiche maintenant :

```
🏗️  INFRASTRUCTURE
----------------------------------------
  Phase actuelle:          PRODUCTION
  Sources:                 2
  Miners assignés:         2 / 2

  📍 ASSIGNATION DES MINERS:
    Source 1: ✅ Miner_123456
      └─ Link disponible
    Source 2: ✅ Miner_123789
```

---

## ⚡ Évolutions Futures

Le MinerManager pose les bases pour :

### 1. Optimisation Dynamique

```javascript
// Futur : Ajuster la taille des miners selon l'économie
if (room.storage.energy > 100000) {
    multiplier = 2.0;  // Miners plus gros si on est riche
}
```

### 2. Priorisation Intelligente

```javascript
// Futur : Créer d'abord les miners sur les sources les plus productives
let sources = MinerManager.analyzeMinerNeeds(room);
sources.sort((a, b) => b.energyCapacity - a.energyCapacity);
```

### 3. Détection de Problèmes

```javascript
// Futur : Alertes si un miner meurt ou si un container est détruit
if (MinerManager.detectMinerIssues(room)) {
    console.log("⚠️  Problème détecté avec les miners !");
}
```

### 4. Multi-Room

```javascript
// Futur : Gérer plusieurs rooms
for (let roomName of Memory.myRooms) {
    let room = Game.rooms[roomName];
    MinerManager.ensureMiners(room);
}
```

---

## 🔍 Comparaison Avant/Après

### Avant : Code Dupliqué

**main.js**
```javascript
if (creepCounts.miners < nbSources) {
    // Logique de spawn...
}
```

**prototype.spawn.js**
```javascript
for (let source of sources) {
    if (!_.some(creepsInRoom, c => c.memory.role == 'miner' && c.memory.sourceId == source.id)) {
        let containers = source.pos.findInRange(...);
        // Logique similaire...
    }
}
```

### Après : Centralisé

**module.minerManager.js**
```javascript
getNextMinerAssignment: function(room) {
    // Toute la logique ici, une seule fois
}
```

**main.js & prototype.spawn.js**
```javascript
let assignment = MinerManager.getNextMinerAssignment(room);
```

---

## 🚀 Migration

### Étape 1 : Ajouter le nouveau module

Créer `module.minerManager.js` dans votre dossier Screeps.

### Étape 2 : Mettre à jour main.js

Remplacer le fichier par la version modifiée.

### Étape 3 : Mettre à jour prototype.spawn.js

Remplacer le fichier par la version modifiée.

### Étape 4 : Tester

Lancer le jeu et vérifier :
- ✅ Les miners existants continuent de fonctionner
- ✅ Les nouveaux miners sont créés avec assignation
- ✅ Le rapport affiche l'état des miners

---

## 📝 Notes Importantes

1. **Compatibilité** : Les miners existants continuent de fonctionner sans modification
2. **Pas de rupture** : Le comportement reste identique, seule l'architecture change
3. **Progressif** : Vous pouvez utiliser soit `USE_MANUAL_SPAWN: true` (orchestrateur) soit `false` (prototype.spawn)
4. **Testable** : Chaque fonction du MinerManager est isolée et facilement testable

---

## 🆘 Dépannage

### Les miners ne sont pas créés

Vérifiez que :
- ✅ Les containers sont construits près des sources (distance ≤ 2)
- ✅ `MinerManager.canSpawnMiners(room)` retourne `true`
- ✅ L'énergie disponible est suffisante (minimum 350)

### Un miner n'est pas assigné à la bonne source

Le MinerManager assigne automatiquement. Si problème :
- Vérifier `assignment.sourceId` avant de spawner
- Consulter le rapport pour voir l'état des assignations

### Le rapport n'affiche pas les miners

Vérifier que `module.reporter.js` importe bien le MinerManager :
```javascript
const MinerManager = require('module.minerManager');
```

---

**Bon mining ! ⛏️**