# 🧪 Test de Fonctionnalité - Instructions Simples

## ▶️ DÉMARRAGE RAPIDE

### **1. Vérifier que le serveur tourne**
```bash
python run.py
```
→ Attendre : "Running on http://127.0.0.1:5000"

### **2. Aller sur l'application** 
→ Navigateur : `http://127.0.0.1:5000`

### **3. Tests Rapides (2 minutes)**

**Navigation Panel :**
- [ ] Je vois des dossiers/templates dans la sidebar gauche ?
- [ ] Le bouton ☰ (hamburger) ouvre/ferme la sidebar ?

**Mode Sombre :**  
- [ ] Le bouton 🌙/☀️ change l'apparence ?
- [ ] L'interface devient sombre/claire ?

**Flèches Précédent/Suivant :**
- [ ] Les boutons ← → sont visibles dans l'éditeur ?
- [ ] Ils permettent de naviguer entre templates ?

**Créer un Dossier :**
- [ ] Bouton "+ Nouveau Dossier" visible ?
- [ ] Modal s'ouvre quand je clique ?
- [ ] Je peux saisir un nom et créer ?

---

## 🔧 SI ÇA NE MARCHE PAS

### **Console Navigateur (F12)**
1. Onglet "Console"
2. Coller et exécuter :
```javascript
// Test rapide
console.log('App loaded:', !!window.app);
console.log('DOM ready:', document.readyState);
console.log('Modules:', window.app ? Array.from(window.app.modules.keys()) : 'No app');
```

### **Force Reset**
```javascript
// Si app existe mais ne répond pas
if (window.app) {
    window.app.setupCriticalDOMEvents();
    console.log('Events re-setup done');
}
```

### **API Test**
```javascript
// Vérifier si l'API répond
fetch('/api/templates').then(r => r.json()).then(data => {
    console.log('Templates:', data.length, 'found');
}).catch(e => console.error('API Error:', e));
```

---

## 📞 RESULTS TO REPORT

**✅ TOUT FONCTIONNE SI :**
- [x] Navigation panel a du contenu
- [x] Mode sombre toggle marche
- [x] Flèches navigation fonctionnent  
- [x] Création dossier fonctionne
- [x] Console : "App loaded: true"

**⚠️ PROBLÈME PARTIEL SI :**
- [x] 2-3 fonctionnalités sur 4 marchent
- [x] Console : quelques warnings mais app loaded

**❌ PROBLÈME TOTAL SI :**
- [ ] Rien ne fonctionne
- [ ] Console : erreurs rouges
- [ ] "App loaded: false"

---

**🎯 BUT : Déterminer rapidement l'état exact de l'application pour cibler les corrections.**