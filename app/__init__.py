"""
Prompt Editor v2.0 - Flask Application Factory

A modern web application for creating, formatting, and managing prompts.
Features markdown editing, template management, and export functionality.
"""

import logging
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from logging.handlers import RotatingFileHandler

# Initialize extensions
db = SQLAlchemy()


def create_app() -> Flask:
    """
    Application factory pattern for Flask app creation.
    
    Returns
    -------
    Flask
        Configured Flask application instance
    """
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.environ.get(
        'SECRET_KEY', 'dev-key-change-in-production'
    )
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', 'sqlite:///prompt_editor.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Initialize extensions with app
    db.init_app(app)
    
    # Register blueprints
    from app.routes import main
    app.register_blueprint(main)
    
    # Configure logging
    if not app.debug and not app.testing:
        if not os.path.exists('logs'):
            os.mkdir('logs')
        file_handler = RotatingFileHandler(
            'logs/prompt_editor.log',
            maxBytes=10240,
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s '
            '[in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('Prompt Editor startup')
    
    return app


def init_db(app: Flask) -> None:
    """
    Initialize database with tables.
    
    Parameters
    ----------
    app : Flask
        Flask application instance
    """
    with app.app_context():
        db.create_all()
        app.logger.info('Database initialized')