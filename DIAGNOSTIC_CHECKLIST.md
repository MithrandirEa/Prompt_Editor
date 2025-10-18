# 🔍 Prompt Editor v2.0 - Diagnostic & Pense-Bête

## 📋 AUDIT COMPLET - Checklist de Vérification

### 🗂️ **STRUCTURE ACTUELLE DES FICHIERS**

#### **Fichiers JavaScript Principaux**
- `app/static/js/app_v2.js` ✅ (Version active - 1170 lignes)
- `app/static/js/app.js` ❌ (Ancien fichier - 3011 lignes - À SUPPRIMER)

#### **Modules Core**
- `app/static/js/core/state.js` ✅ Gestion d'état
- `app/static/js/config/constants.js` ✅ Configuration
- `app/static/js/utils/logger.js` ✅ Logging
- `app/static/js/utils/errorHandler.js` ✅ Erreurs

#### **Managers**
- `app/static/js/managers/apiClient.js` ✅ API
- `app/static/js/managers/templateManager.js` ✅ Templates  
- `app/static/js/managers/searchManager.js` ✅ Recherche

#### **UI**
- `app/static/js/ui/uiManager.js` ✅ Interface

#### **HTML Template**
- `app/templates/index.html` ✅ (572 lignes)

---

## 🚨 **PROBLÈMES IDENTIFIÉS**

### 1. **CONFLIT DE FICHIERS JS**
- ❌ `app.js` (3011 lignes) existe encore et peut créer des conflits
- ✅ `app_v2.js` est le fichier actif selon index.html
- **ACTION**: Supprimer définitivement `app.js`

### 2. **CHARGEMENT DES MODULES**
```html
<!-- Dans index.html line 572 -->
<script type="module" src="{{ url_for('static', filename='js/app_v2.js') }}">
```
- **VÉRIFIER**: Tous les imports ES6 dans app_v2.js
- **VÉRIFIER**: Compatibilité des modules

### 3. **FONCTIONNALITÉS À TESTER**
- [ ] Sidebar toggle (masquer/afficher)
- [ ] Mode sombre 
- [ ] Navigation précédent/suivant
- [ ] Création de templates
- [ ] Sauvegarde de templates
- [ ] Création de dossiers
- [ ] Navigation dans l'arborescence
- [ ] Recherche globale
- [ ] Aperçu Markdown
- [ ] Export de templates
- [ ] Gestion des favoris

---

## 📝 **PLAN D'ACTION ÉTAPE PAR ÉTAPE**

### **PHASE 1: Nettoyage** ⏳
1. ✅ Supprimer `app.js` définitivement
2. ✅ Vérifier que seul `app_v2.js` est chargé
3. ✅ Vérifier tous les imports de modules

### **PHASE 2: Test des Fonctionnalités Core** ⏳
1. [ ] Démarrage application (console.log startup)
2. [ ] Chargement initial (templates/dossiers)
3. [ ] Event listeners (click, input, etc.)
4. [ ] State management (création/modification)

### **PHASE 3: Test Interface Utilisateur** ⏳
1. [ ] Sidebar (toggle, expand/collapse)
2. [ ] Tabs (Editor/Manager switch)
3. [ ] Theme toggle (dark/light)
4. [ ] Modal systems (folder creation)

### **PHASE 4: Test Fonctionnalités Avancées** ⏳
1. [ ] Markdown editor + preview
2. [ ] Template CRUD operations
3. [ ] Folder management
4. [ ] Search functionality
5. [ ] Export features

### **PHASE 5: Test Intégration API** ⏳
1. [ ] GET /api/templates
2. [ ] POST /api/templates
3. [ ] GET /api/folders  
4. [ ] POST /api/folders
5. [ ] Error handling

---

## 🔧 **COMMANDES DE DIAGNOSTIC**

### **Vérifier le serveur**
```bash
python run.py
# Ouvrir http://127.0.0.1:5000
# Console F12 pour vérifier les erreurs JS
```

### **Tester les modules**
```bash
npm test                    # Tous les tests
npm run test:frontend      # Tests d'intégration
npm run test:modules       # Tests unitaires
npm run test:e2e          # Tests end-to-end
```

### **Vérifier les imports**
```javascript
// Dans la console du navigateur
console.log(window.app);           // App instance
console.log(window.logger);        // Logger
console.log(window.state);         // State manager
```

---

## 🎯 **POINTS DE CONTRÔLE CRITIQUES**

### **1. Application Startup**
```javascript
// Dans app_v2.js - Vérifier ces lignes:
- createApp() est appelé au DOMContentLoaded
- Tous les modules sont importés correctement
- setupCriticalDOMEvents() fonctionne
- loadInitialData() charge templates et dossiers
```

### **2. Event Handlers**
```javascript
// Vérifier que ces éléments ont des listeners:
- #toggle-sidebar
- #theme-toggle  
- #editor-tab, #manager-tab
- #save-template
- #new-folder-btn
- #global-search
- #nav-back-btn, #nav-forward-btn
```

### **3. API Integration**
```javascript
// Vérifier les réponses API:
- /api/templates retourne {data: [...]}
- /api/folders retourne {data: [...]}
- Gestion des erreurs 404, 500, etc.
```

### **4. State Consistency**
```javascript
// Vérifier la cohérence:
- State.getPrompts() reflète les templates chargés
- State.getCurrentPrompt() est sync avec l'éditeur
- Les modifications UI mettent à jour le state
```

---

## 🐛 **ERREURS COMMUNES À CHERCHER**

### **Console JavaScript**
- `addEventListener is not a function` → Module non EventTarget
- `Cannot read property of undefined` → DOM element manquant
- `fetch is not defined` → Import manquant
- `Module not found` → Chemin import incorrect

### **Réseau (Tab Network F12)**
- Status 404 sur `/static/js/...` → Fichier manquant
- Status 500 sur `/api/...` → Erreur serveur Python
- CORS errors → Configuration serveur

### **Interface Utilisateur**
- Boutons non cliquables → Event listener manquant
- Onglets qui ne switchent pas → CSS/JS logic issue
- Modal qui ne s'ouvre pas → DOM manipulation erreur
- Thème qui ne change pas → localStorage/CSS issue

---

## 📊 **MÉTRIQUES DE SANTÉ**

### **Performance** ⚡
- [ ] Temps de chargement < 2s
- [ ] Pas de memory leaks
- [ ] Réactivité interface < 100ms

### **Fonctionnalité** ✅
- [ ] 100% des boutons fonctionnels
- [ ] Toutes les API calls réussies
- [ ] Pas d'erreurs console

### **UX** 🎨
- [ ] Feedback visuel sur toutes actions
- [ ] Transitions fluides
- [ ] États loading appropriés

---

## 🚀 **COMMANDE RAPIDE DE RÉSOLUTION**

```bash
# 1. Nettoyer les conflits
rm app/static/js/app.js

# 2. Redémarrer serveur  
python run.py

# 3. Tester dans navigateur
# → F12 Console pour erreurs
# → Tester chaque bouton/fonction
# → Vérifier Network tab pour API calls

# 4. Si problème persiste
npm test
```

---

## 📞 **CONTACT POINTS**

- **Fichier principal**: `app_v2.js` (Orchestrateur)
- **Point d'entrée**: `createApp()` function  
- **Debug global**: `window.app` dans console
- **Logs**: `window.logger.debug(message)`

---

*Dernière mise à jour: 18 octobre 2025*
*Version: 2.0.0*