# 📋 TEST MANUEL - Prompt Editor v2.0

## Instructions pour le Diagnostic
1. Ouvrir http://127.0.0.1:5000 dans le navigateur
2. Ouvrir la Console (F12)
3. Coller le script diagnostic_script.js dans la console
4. Suivre les résultats step by step ci-dessous

## ✅ TESTS À EFFECTUER MANUELLEMENT

### 1. **Démarrage Application**
- [ ] Page se charge sans erreur
- [ ] Pas d'erreurs rouges dans la console F12
- [ ] Logs "🚀 Prompt Editor v2.0 - Application created" visible

### 2. **Sidebar (Panneau Gauche)**
- [ ] Sidebar visible par défaut
- [ ] Bouton "←" (toggle-sidebar) cache la sidebar
- [ ] Bouton "→" (expand-sidebar) réaffiche la sidebar
- [ ] Templates récents affichés dans la sidebar

### 3. **Barre de Navigation (Header)**
- [ ] Bouton ← (nav-back-btn) cliquable
- [ ] Bouton → (nav-forward-btn) cliquable  
- [ ] Bouton 🌙 (theme-toggle) change le thème clair/sombre
- [ ] Zone de recherche "Rechercher..." fonctionnelle
- [ ] Bouton "Nouveau" crée un nouveau template

### 4. **Onglets**
- [ ] Onglet "Édition" actif par défaut (bleu)
- [ ] Clic sur "Gestion" switch vers l'onglet gestionnaire
- [ ] Clic sur "Édition" revient à l'éditeur
- [ ] Contenu change selon l'onglet sélectionné

### 5. **Éditeur de Templates (Onglet Édition)**
- [ ] Zone titre "Titre du template..." éditable
- [ ] Zone éditeur Markdown grande zone de texte
- [ ] Aperçu en temps réel à droite
- [ ] Bouton "Sauvegarder" fonctionne
- [ ] Barre d'outils Markdown (B, I, H, etc.) fonctionne

### 6. **Gestionnaire (Onglet Gestion)**
- [ ] Section Navigation à gauche avec arborescence
- [ ] Section "Tous les templates" à droite
- [ ] Bouton "Nouveau dossier" ouvre une modale
- [ ] Bouton "Télécharger tous" fonctionne
- [ ] Boutons "Favoris" et "Voir tout" filtrent

### 7. **Fonctionnalités Avancées**
- [ ] Recherche globale filtre les templates
- [ ] Mode sombre persiste après rechargement
- [ ] Sauvegarde de template avec notification
- [ ] Création de dossier avec validation
- [ ] Navigation entre les dossiers

## 🐛 PROBLÈMES POSSIBLES & SOLUTIONS

### Si aucun bouton ne fonctionne:
```javascript
// Dans la console, vérifier:
console.log(window.app); // Doit afficher l'instance
window.app.setupCriticalDOMEvents(); // Re-setup des événements
```

### Si les templates ne se chargent pas:
```javascript
// Vérifier les API:
fetch('/api/templates').then(r => r.json()).then(console.log);
fetch('/api/folders').then(r => r.json()).then(console.log);
```

### Si les modules ne se chargent pas:
- Vérifier Network tab (F12) pour erreurs 404
- Vérifier que tous les fichiers existent dans `/static/js/`

### Si le thème ne fonctionne pas:
```javascript
// Forcer le thème:
document.documentElement.classList.toggle('dark');
localStorage.setItem('theme', 'dark'); // ou 'light'
```

## 📊 MÉTRIQUES DE RÉUSSITE

**✅ APPLICATION FONCTIONNELLE SI:**
- 90%+ des tests cochés ✅
- Aucune erreur rouge dans la console
- Tous les boutons/interactions répondent
- Les API calls réussissent (status 200/201)

**❌ PROBLÈMES À CORRIGER SI:**
- Plus de 3 tests échouent
- Erreurs JavaScript dans la console
- Boutons non réactifs
- API calls échouent (status 404/500)

## 🔧 COMMANDES DE DÉPANNAGE

```bash
# Redémarrer le serveur
python run.py

# Vider le cache navigateur
Ctrl+Shift+R (hard refresh)

# Vérifier les fichiers
ls app/static/js/
ls app/static/js/*/
```

## 📝 RAPPORT DE TEST

Date: ___________
Navigateur: ___________
Version: ___________

### Résultats:
- Tests réussis: ___/20
- Erreurs détectées: ___________
- Fonctionnalités non-fonctionnelles: ___________

### Actions à prendre:
1. ___________
2. ___________
3. ___________