# 📋 Guide d'utilisation de l'Orchestrateur Screeps

## 🎯 Objectif

Ce système vous donne le contrôle total sur la création de creeps via un fichier de configuration central. Plus besoin de modifier le code pour ajuster les quotas !

---

## 📁 Nouveaux Fichiers

### 1. **config.orchestrator.js**
Le centre de contrôle de votre colonie. Tous les paramètres sont ici.

### 2. **module.reporter.js**
Génère des rapports détaillés toutes les 5 minutes (configurable).

### 3. **main.js (modifié)**
Intègre l'orchestrateur et le reporter.

---

## 🎮 Comment utiliser l'Orchestrateur

### Exemple 1 : Augmenter le nombre d'upgraders

Ouvrez `config.orchestrator.js` et modifiez :

```javascript
PRODUCTION: {
    upgraders: 6,  // Au lieu de 4
    // ... reste inchangé
}
```

### Exemple 2 : Ajouter plus de builders en phase CONSTRUCTION

```javascript
CONSTRUCTION: {
    builders: 3,  // Au lieu de 2
    // ... reste inchangé
}
```

### Exemple 3 : Créer des creeps plus gros

```javascript
BODY_SIZE_MULTIPLIER: {
    worker: 1.5,    // Upgraders/Builders 50% plus gros
    lorry: 2.0,     // Lorries 2x plus gros
    // ...
}
```

### Exemple 4 : Modifier les priorités de spawn

Si vous voulez que les builders soient créés avant les upgraders :

```javascript
SPAWN_PRIORITY: {
    harvesters: 1,
    miners: 2,
    lorries: 3,
    builders: 4,    // Au lieu de 5
    upgraders: 5,   // Au lieu de 4
    longDistanceHarvesters: 6
}
```

---

## 📊 Rapport Automatique

### Format du Rapport

Toutes les 5 minutes (300 ticks), vous verrez :

```
================================================================================
📊 RAPPORT DE COLONIE - Tick 12345
================================================================================

👥 POPULATION DES CREEPS
----------------------------------------
  Harvesters:                0 / 0
  Miners:                    2 / auto
  Lorries:                   2 / auto
  Upgraders:                 4 / 4
  Builders:                  1 / 1
  Long Distance Harv.:       2 / 2
  ──────────────────────────────────────
  TOTAL:                     11
  ⚠️  Creeps mourants:        1 (< 100 ticks)

💰 ÉCONOMIE
----------------------------------------
  Énergie disponible:      800 / 800 (100.0%)
  Storage:                 45000 / 1000000 (4.5%)
  Containers (2):          1500 / 4000 (37.5%)
  Production estimée:      100 energy/tick

🏗️  INFRASTRUCTURE
----------------------------------------
  Phase actuelle:          PRODUCTION
  Sources:                 2
  Miners assignés:         2 / 2
  Containers:              2 / 2
  Sites construction:      0
  Extensions:              10
  Tours:                   2
  Links:                   3

🎯 CONTROLLER
----------------------------------------
  Niveau:                  RCL 4
  Progression:             12500 / 80000
  Pourcentage:             15.63%
  Taux upgrade:            12 energy/tick
  Temps estimé RCL 5:      1.6 heures
  Downgrade dans:          19500 ticks

⚙️  CPU & BUCKET
----------------------------------------
  CPU utilisé:             18.45 / 20
  Bucket:                  9500 / 10000
  ✨ Génération de pixels activée

================================================================================
```

### Changer l'intervalle du rapport

Dans `config.orchestrator.js` :

```javascript
REPORT_INTERVAL: 600,  // 10 minutes au lieu de 5
```

---

## ⚙️ Options Avancées

### Quotas "auto"

Certains quotas peuvent être réglés sur `'auto'` :

- **`miners: 'auto'`** → 1 miner par source
- **`lorries: 'auto'`** → 1 lorry par miner

### Seuil d'énergie minimum

Pour éviter de spawn quand vous êtes à court d'énergie :

```javascript
MIN_ENERGY_PERCENT_FOR_SPAWN: 0.7,  // Spawn seulement si > 70% d'énergie
```

### Mode de spawn

Choisir entre le spawn manuel (main.js) ou automatique (prototype.spawn) :

```javascript
USE_MANUAL_SPAWN: true,  // true = orchestrateur, false = prototype.spawn
```

---

## 🔧 Configurations Typiques

### Début de partie (Bootstrap rapide)

```javascript
BOOTSTRAP: {
    harvesters: 3,  // Plus de harvesters pour démarrer vite
    builders: 2,
    upgraders: 1,
    miners: 0,
    lorries: 0,
    longDistanceHarvesters: 0
}
```

### Focus Construction

```javascript
CONSTRUCTION: {
    harvesters: 1,
    builders: 4,     // Beaucoup de builders
    upgraders: 1,    // Peu d'upgraders
    miners: 'auto',
    lorries: 2,      // Plus de lorries pour transporter
    longDistanceHarvesters: 0
}
```

### Focus Upgrade

```javascript
PRODUCTION: {
    harvesters: 0,
    builders: 1,
    upgraders: 8,    // Maximum d'upgraders
    miners: 'auto',
    lorries: 'auto',
    longDistanceHarvesters: 0
}
```

### Expansion Agressive

```javascript
PRODUCTION: {
    harvesters: 0,
    builders: 2,
    upgraders: 2,
    miners: 'auto',
    lorries: 'auto',
    longDistanceHarvesters: 4  // Plus de LDH pour coloniser
}
```

---

## 📈 Évolution Future

Le rapport sera enrichi avec :

- ✅ Population de creeps ✓
- ✅ Économie ✓
- ✅ Infrastructure ✓
- ✅ Controller ✓
- ✅ CPU ✓
- 🔜 Défense (ennemis détectés, dégâts subis)
- 🔜 Commerce (ressources, market)
- 🔜 Statistiques historiques
- 🔜 Recommandations automatiques

---

## 🚀 Pour aller plus loin

### Créer des profils pré-configurés

Vous pouvez créer des "presets" dans `config.orchestrator.js` :

```javascript
PRESETS: {
    EARLY_GAME: {
        PRODUCTION: { upgraders: 6, builders: 2, ... }
    },
    MID_GAME: {
        PRODUCTION: { upgraders: 4, builders: 1, ... }
    },
    LATE_GAME: {
        PRODUCTION: { upgraders: 2, builders: 1, ... }
    }
},

ACTIVE_PRESET: 'EARLY_GAME'  // Changer facilement de profil
```

### Orchestrateur intelligent (prochaine étape)

L'orchestrateur pourra bientôt :
- Détecter automatiquement si vous manquez d'énergie → réduire les upgraders
- Détecter une attaque → créer plus de défenseurs
- Détecter beaucoup de construction → augmenter les builders
- Suggérer des optimisations

---

## 🆘 Dépannage

### Le rapport ne s'affiche pas

Vérifiez que vous avez bien `require('module.reporter')` dans main.js.

### Les creeps ne sont pas créés selon la config

Assurez-vous que `USE_MANUAL_SPAWN: true` dans config.orchestrator.js.

### Les miners ne sont pas créés

Les miners sont gérés par `prototype.spawn` pour éviter les conflits. Assurez-vous que les containers sont construits près des sources.

---

## 📝 Notes Importantes

1. **Les miners** restent gérés par `prototype.spawn.js` car ils nécessitent une assignation précise aux sources avec containers.

2. **Les modifications de config** prennent effet immédiatement (pas besoin de redémarrer).

3. **Le système de phases** (BOOTSTRAP → CONSTRUCTION → PRODUCTION) est automatique et ne nécessite pas de configuration.

4. **Les quotas par phase** vous permettent d'avoir différentes compositions selon l'avancement de votre colonie.

---

**Bon jeu ! 🎮**