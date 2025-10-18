"""
Entry point for Prompt Editor v2.0 Flask application.

This script creates and runs the Flask application instance.
For development purposes only - use WSGI server for production.
"""

import os
from app import create_app, init_db

# Create Flask application instance
app = create_app()

if __name__ == '__main__':
    # Initialize database on first run
    if not os.path.exists('prompt_editor.db'):
        init_db(app)
    
    # Run development server
    app.run(
        debug=True,
        host='127.0.0.1',
        port=5000,
        threaded=True
    )