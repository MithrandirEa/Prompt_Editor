# Prompt Editor v2.0

Une application web moderne pour créer, formater et gérer des modèles de prompts avec support Markdown complet.

## 🚀 Fonctionnalités

### ✏️ Éditeur de Prompts
- **Édition Markdown** avec barre d'outils intuitive
- **Aperçu en temps réel** du rendu Markdown
- **Auto-sauvegarde** intelligente
- **Raccourcis clavier** (Ctrl+S, Ctrl+N)
- **Support complet Markdown** : titres, listes, citations, code, liens

### 📁 Gestionnaire de Templates
- **Organisation hiérarchique** avec dossiers et sous-dossiers
- **Vue en arborescence** pour navigation facile
- **Système de favoris** pour templates fréquents
- **Recherche avancée** par titre, contenu et description
- **Drag & drop** pour réorganisation

### 📤 Export Multi-formats
- **Export Markdown** (.md) avec métadonnées
- **Export Texte** (.txt) avec formatage propre
- **Statistiques détaillées** : mots, caractères, temps de lecture
- **Noms de fichiers sécurisés** automatiquement

### 🎨 Interface Moderne
- **Design épuré** inspiré des applications 2025
- **Tailwind CSS** pour un rendu moderne
- **Responsive design** adaptatif mobile/desktop
- **Animations fluides** et transitions soignées
- **Toast notifications** pour feedback utilisateur

## 🛠️ Technologies

- **Backend** : Flask 3.0, SQLAlchemy, SQLite
- **Frontend** : HTML5, Tailwind CSS, JavaScript ES6+
- **Base de données** : SQLite avec migrations
- **Tests** : pytest avec couverture complète
- **Documentation** : NumPy docstrings

## 📦 Installation

### Prérequis
- Python 3.8+
- pip

### Installation rapide

```bash
# Cloner le projet
git clone <repository-url>
cd Prompt_Editor_v2

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate     # Windows

# Installer les dépendances
pip install -r requirements.txt

# Lancer l'application
python run.py
```

L'application sera accessible sur `http://127.0.0.1:5000`

## 🏗️ Architecture

```
Prompt_Editor_v2/
├── app/
│   ├── __init__.py          # Factory Flask + configuration
│   ├── models.py            # Modèles SQLAlchemy (Template, Folder)
│   ├── routes.py            # Routes et API REST
│   ├── templates/
│   │   └── index.html       # Interface utilisateur principale
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css    # Styles personnalisés
│   │   └── js/
│   │       └── app.js       # Logique client JavaScript
│   └── utils/
│       └── export.py        # Utilitaires d'export
├── tests/
│   ├── conftest.py          # Configuration pytest
│   ├── test_models.py       # Tests des modèles
│   ├── test_routes.py       # Tests des routes
│   └── test_export.py       # Tests d'export
├── requirements.txt         # Dépendances Python
└── run.py                   # Point d'entrée application
```

## 🔧 API REST

### Templates
- `GET /api/templates` - Liste des templates avec filtres
- `POST /api/templates` - Créer un nouveau template
- `GET /api/templates/{id}` - Récupérer un template
- `PUT /api/templates/{id}` - Mettre à jour un template
- `DELETE /api/templates/{id}` - Supprimer un template

### Dossiers
- `GET /api/folders` - Liste des dossiers
- `POST /api/folders` - Créer un nouveau dossier

### Export
- `GET /export/md/{id}` - Export Markdown
- `GET /export/txt/{id}` - Export texte

## 🧪 Tests

```bash
# Lancer tous les tests
pytest

# Avec couverture
pytest --cov=app

# Tests spécifiques
pytest tests/test_models.py
pytest tests/test_routes.py
pytest tests/test_export.py
```

## 🎯 Utilisation

### 1. Créer un Template
1. Cliquer sur "Nouveau" dans l'en-tête
2. Saisir un titre descriptif
3. Rédiger le contenu en Markdown
4. Utiliser la barre d'outils pour le formatage
5. Sauvegarder avec Ctrl+S ou le bouton

### 2. Organiser avec des Dossiers
1. Aller dans l'onglet "Gestion"
2. Cliquer "Nouveau dossier"
3. Glisser-déposer les templates
4. Créer une hiérarchie logique

### 3. Rechercher et Filtrer
- **Recherche globale** : barre en haut à droite
- **Filtre favoris** : bouton étoile dans la gestion
- **Filtre par dossier** : cliquer sur un dossier

### 4. Exporter
1. Ouvrir le template à exporter
2. Cliquer sur l'icône Markdown ou Texte
3. Le fichier se télécharge automatiquement

## ⚡ Performance

- **Temps de réponse** : < 500ms garanti
- **Auto-sauvegarde** : toutes les 5 secondes
- **Lazy loading** : chargement optimisé des données
- **Cache intelligent** : mise en cache côté client

## 🔒 Sécurité

- **Échappement HTML** : prévention XSS
- **Validation côté serveur** : données sécurisées
- **Noms de fichiers sécurisés** : caractères dangereux supprimés
- **Limite de taille** : 16MB max par template

## 🚀 Roadmap

### Version 2.1 (Prochaine)
- [ ] Collaboration temps réel
- [ ] Thèmes sombre/clair
- [ ] Import de fichiers Markdown
- [ ] API publique avec authentification

### Version 2.2 (Future)
- [ ] Plugin VSCode
- [ ] Support Git pour versioning
- [ ] Templates partagés communauté
- [ ] Export PDF avec mise en page

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👨‍💻 Auteur

Développé avec ❤️ pour la communauté des créateurs de prompts.

---

**Prompt Editor v2.0** - L'outil ultime pour vos prompts IA ✨