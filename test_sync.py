#!/usr/bin/env python3
"""
Script de test pour la synchronisation filesystem
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.utils.filesystem import sync_filesystem_to_database

def test_sync():
    app = create_app()
    
    with app.app_context():
        try:
            print("🔄 Démarrage de la synchronisation...")
            sync_filesystem_to_database()
            print("✅ Synchronisation terminée avec succès !")
            
            # Vérifier les résultats
            from app.models import Template
            templates = Template.query.all()
            print(f"\n📊 Total des templates en base: {len(templates)}")
            
            for template in templates:
                print(f"   - {template.title}")
                
        except Exception as e:
            print(f"❌ Erreur lors de la synchronisation: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_sync()