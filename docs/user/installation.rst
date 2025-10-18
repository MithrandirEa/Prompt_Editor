=======================
Guide d'Installation
=======================

Ce guide vous aidera à installer et configurer Prompt Editor v2.0 sur votre système.

📋 Prérequis
============

Avant d'installer Prompt Editor v2.0, assurez-vous d'avoir :

* **Python 3.8+** installé sur votre système
* **Git** pour cloner le repository (optionnel)
* Un navigateur web moderne (Chrome, Firefox, Safari, Edge)

🔧 Installation
===============

Option 1: Clone depuis GitHub
-----------------------------

.. code-block:: bash

   # Cloner le repository
   git clone https://github.com/Mithrandir/prompt-editor-v2.git
   cd prompt-editor-v2
   
   # Créer un environnement virtuel
   python -m venv venv
   
   # Activer l'environnement virtuel
   # Sur Windows:
   venv\Scripts\activate
   # Sur macOS/Linux:
   source venv/bin/activate
   
   # Installer les dépendances
   pip install -r requirements.txt

Option 2: Installation manuelle
-------------------------------

1. Téléchargez le code source depuis GitHub
2. Extraire l'archive dans un dossier de votre choix
3. Suivez les mêmes étapes que l'option 1 à partir de la création de l'environnement virtuel

🚀 Lancement de l'Application
=============================

Une fois l'installation terminée :

.. code-block:: bash

   # Activer l'environnement virtuel (si pas déjà fait)
   venv\Scripts\activate  # Windows
   source venv/bin/activate  # macOS/Linux
   
   # Lancer l'application
   python run.py

L'application sera accessible à l'adresse : http://127.0.0.1:5000

🔧 Configuration
================

Base de Données
---------------

Par défaut, l'application utilise SQLite. La base de données sera créée automatiquement au premier lancement dans le fichier ``prompt_editor.db``.

Variables d'Environnement
-------------------------

Vous pouvez configurer l'application via les variables d'environnement suivantes :

.. code-block:: bash

   # Port d'écoute (défaut: 5000)
   export FLASK_PORT=5000
   
   # Mode debug (défaut: True en développement)
   export FLASK_DEBUG=True
   
   # Clé secrète pour les sessions
   export SECRET_KEY="your-secret-key-here"

🛠️ Dépannage
=============

Erreurs Courantes
-----------------

**Erreur : "Module not found"**
   Vérifiez que l'environnement virtuel est activé et que les dépendances sont installées.

**Erreur : "Port already in use"**
   Changez le port avec la variable d'environnement ``FLASK_PORT`` ou arrêtez l'autre processus.

**Erreur : "Permission denied"**
   Assurez-vous d'avoir les droits d'écriture dans le dossier de l'application.

**Base de données corrompue**
   Supprimez le fichier ``prompt_editor.db`` - il sera recréé au prochain lancement.

🔄 Mise à Jour
==============

Pour mettre à jour vers une nouvelle version :

.. code-block:: bash

   # Sauvegarder votre base de données
   cp prompt_editor.db prompt_editor_backup.db
   
   # Mettre à jour le code
   git pull origin main
   
   # Mettre à jour les dépendances
   pip install -r requirements.txt --upgrade
   
   # Relancer l'application
   python run.py

.. warning::
   Toujours sauvegarder votre base de données avant une mise à jour !

📞 Support
==========

En cas de problème :

1. Vérifiez cette documentation
2. Consultez les `Issues GitHub <https://github.com/Mithrandir/prompt-editor-v2/issues>`_
3. Créez une nouvelle issue si nécessaire