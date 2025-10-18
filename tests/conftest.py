"""
Test configuration for Prompt Editor v2.0

This module provides pytest configuration and shared fixtures
for testing the Flask application.
"""

import pytest
import tempfile
import os
from app import create_app, db
from app.models import Template, Folder, init_default_data


@pytest.fixture
def app():
    """
    Create application instance for testing.
    
    Returns
    -------
    Flask
        Test Flask application
    """
    # Create temporary database
    db_fd, db_path = tempfile.mkstemp()
    
    app = create_app()
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}',
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key'
    })
    
    with app.app_context():
        db.create_all()
        init_default_data()
        yield app
        
        # Cleanup
        db.drop_all()
        os.close(db_fd)
        os.unlink(db_path)


@pytest.fixture
def client(app):
    """
    Create test client.
    
    Parameters
    ----------
    app : Flask
        Test application
        
    Returns
    -------
    FlaskClient
        Test client for making requests
    """
    return app.test_client()


@pytest.fixture
def runner(app):
    """
    Create test CLI runner.
    
    Parameters
    ----------
    app : Flask
        Test application
        
    Returns
    -------
    FlaskCliRunner
        CLI runner for testing commands
    """
    return app.test_cli_runner()


@pytest.fixture
def sample_template(app):
    """
    Create sample template for testing.
    
    Parameters
    ----------
    app : Flask
        Test application
        
    Returns
    -------
    Template
        Sample template instance
    """
    with app.app_context():
        template = Template(
            title='Test Template',
            content='# Test\n\nThis is a **test** template.',
            description='A test template for unit testing',
            is_favorite=True
        )
        db.session.add(template)
        db.session.commit()
        return template


@pytest.fixture
def sample_folder(app):
    """
    Create sample folder for testing.
    
    Parameters
    ----------
    app : Flask
        Test application
        
    Returns
    -------
    Folder
        Sample folder instance
    """
    with app.app_context():
        folder = Folder(name='Test Folder')
        db.session.add(folder)
        db.session.commit()
        return folder