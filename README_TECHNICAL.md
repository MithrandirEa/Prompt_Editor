# Prompt Editor v2.0 - Documentation Technique

## Architecture de l'Application

### Vue d'ensemble
L'application Prompt Editor v2.0 est une application web Flask avec une interface JavaScript moderne utilisant le pattern Singleton pour gérer l'état global.

### Structure du Code JavaScript

#### 1. **Objet Application Principal (App)**
- **Pattern**: Singleton
- **Responsabilité**: Gestion centralisée de l'état et coordination des composants
- **État global**: `App.state` contient toutes les données partagées

#### 2. **Organisation Modulaire**
Le code est organisé en sections logiques :

```javascript
// =====================================
// GESTION DES ÉVÉNEMENTS
// =====================================

// =====================================
// GESTION DE LA NAVIGATION
// =====================================

// =====================================
// GESTION DE LA RECHERCHE
// =====================================

// =====================================
// GESTION DES TEMPLATES
// =====================================

// =====================================
// GESTION DE LA SIDEBAR
// =====================================

// =====================================
// GESTION DU MARKDOWN
// =====================================

// =====================================
// GESTION DE L'AUTO-SAUVEGARDE
// =====================================

// =====================================
// GESTION DU THÈME
// =====================================

// =====================================
// FONCTIONS UTILITAIRES
// =====================================
```

### Fonctionnalités Principales

#### **1. Système de Navigation**
- **Navigation par onglets** : Édition / Gestion
- **Historique de navigation** : Boutons précédent/suivant
- **État persistant** : Restauration automatique

#### **2. Recherche Avancée**
- **Recherche en temps réel** avec debounce (300ms)
- **Interface dédiée** pour les résultats
- **Restoration automatique** de l'interface après sélection

#### **3. Gestion des Templates**
- **CRUD complet** : Création, lecture, mise à jour, suppression
- **Auto-sauvegarde** : Sauvegarde automatique après 2 secondes d'inactivité
- **Historique** : Suivi des templates récents et favoris

#### **4. Éditeur Markdown**
- **Aperçu en temps réel** avec convertisseur intégré
- **Barre d'outils** pour formatage rapide
- **Raccourcis clavier** : Ctrl+S (sauvegarder), Ctrl+N (nouveau), Ctrl+F (rechercher)

#### **5. Interface Adaptative**
- **Sidebar rétractable** avec état persistant
- **Thème sombre/clair** automatique ou manuel
- **Interface responsive** pour différentes tailles d'écran

### État de l'Application (`App.state`)

```javascript
state: {
    currentTemplate: null,        // Template actuellement édité
    currentTab: 'editor',         // Onglet actif
    currentFolder: null,          // Dossier sélectionné
    autoSaveTimeout: null,        // Timer d'auto-sauvegarde
    navigationHistory: [],        // Historique de navigation
    currentHistoryIndex: -1,      // Position dans l'historique
    isSearchMode: false          // Mode recherche actif
}
```

### API Endpoints Utilisés

#### **Templates**
- `GET /api/templates` - Liste des templates
- `GET /api/templates?search=query` - Recherche
- `GET /api/templates?favorites=true` - Templates favoris
- `GET /api/templates/{id}` - Template spécifique
- `POST /api/templates` - Création
- `PUT /api/templates/{id}` - Mise à jour
- `DELETE /api/templates/{id}` - Suppression

#### **Dossiers**
- `GET /api/folders` - Arbre des dossiers
- `POST /api/folders` - Création de dossier
- `PUT /api/folders/{id}` - Mise à jour

### Gestion des Événements

#### **Principe de Délégation**
Utilisation de la délégation d'événements pour optimiser les performances :

```javascript
// Au lieu de lier chaque élément individuellement
container.addEventListener('click', (e) => {
    const templateItem = e.target.closest('.template-item');
    if (templateItem) {
        const templateId = parseInt(templateItem.dataset.templateId);
        this.loadTemplate(templateId);
    }
});
```

#### **Debouncing**
Utilisation du debouncing pour les événements fréquents (recherche, auto-sauvegarde) :

```javascript
searchInput.addEventListener('input', this.debounce((e) => {
    this.performSearch(e.target.value.trim());
}, 300));
```

### Gestion d'État Cohérente

#### **Mode Recherche**
Le système bascule entre l'interface normale et l'interface de recherche :

```javascript
// Activation du mode recherche
this.state.isSearchMode = true;
this.showSearchResults(templates, query);

// Désactivation et restauration
this.state.isSearchMode = false;
this.restoreMainInterface();
```

#### **Restauration d'Interface**
Mécanisme robuste pour restaurer l'interface après une recherche :

1. Détection de l'état de recherche
2. Génération HTML propre
3. Réinitialisation des événements
4. Restauration de l'état précédent

### Fonctions Utilitaires

#### **Sécurité**
- `escapeHtml()` : Protection contre XSS
- Validation des entrées utilisateur
- Gestion d'erreurs complète

#### **UX/UI**
- `showToast()` : Notifications utilisateur
- `debounce()` : Optimisation des performances
- Animations CSS fluides

### Améliorations Apportées

#### **1. Code Nettoyé**
- ✅ Suppression du code dupliqué
- ✅ Élimination des fonctions de débogage temporaires
- ✅ Structure modulaire claire
- ✅ Documentation JSDoc complète

#### **2. Gestion d'État Robuste**
- ✅ État centralisé dans `App.state`
- ✅ Pas de conflits d'événements
- ✅ Restauration d'interface fiable
- ✅ Mode recherche clairement défini

#### **3. Performance Optimisée**
- ✅ Délégation d'événements
- ✅ Debouncing pour la recherche
- ✅ Chargement paresseux des composants
- ✅ Réutilisation des éléments DOM

#### **4. Maintenabilité**
- ✅ Code organisé en sections logiques
- ✅ Fonctions avec responsabilité unique
- ✅ Commentaires et documentation
- ✅ Conventions de nommage cohérentes

### Tests Recommandés

#### **Tests Unitaires**
```javascript
// Exemple de test pour la fonction de recherche
describe('App.performSearch', () => {
    it('should clear search for queries less than 2 characters', () => {
        App.performSearch('a');
        expect(App.state.isSearchMode).toBe(false);
    });
});
```

#### **Tests d'Intégration**
- Navigation entre onglets
- Chargement et sauvegarde de templates
- Fonctionnement de la recherche
- Restauration d'interface

#### **Tests E2E**
- Workflow complet utilisateur
- Persistance des données
- Responsive design
- Accessibilité

### Migration et Déploiement

#### **Fichiers Modifiés**
- `app/static/js/app.js` : Version nettoyée
- `app/static/js/app_old.js` : Sauvegarde de l'ancienne version

#### **Compatibilité**
- ✅ Même API que l'ancienne version
- ✅ Même interface utilisateur
- ✅ Données existantes préservées

#### **Rollback**
En cas de problème, restaurer avec :
```bash
cd app/static/js
Move-Item app.js app_new.js
Move-Item app_old.js app.js
```

### Prochaines Étapes

1. **Tests** : Implémentation de la suite de tests
2. **Documentation utilisateur** : Guide d'utilisation
3. **Optimisations** : Bundle JavaScript, minification
4. **Fonctionnalités** : Export avancé, collaboration

### Support et Maintenance

#### **Debugging**
- Console.log structurés avec émojis pour faciliter le débogage
- Gestion d'erreurs avec try/catch complets
- Messages d'erreur informatifs pour l'utilisateur

#### **Monitoring**
- Toasts pour feedback utilisateur immédiat
- Logging des erreurs côté client
- Métriques de performance basiques

Cette architecture garantit une application robuste, maintenable et extensible pour l'avenir.