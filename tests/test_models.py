"""
Unit tests for Template and Folder models.

This module tests the database models including their methods,
relationships, and data validation.
"""

from datetime import datetime
from app import db
from app.models import Template, Folder


class TestTemplate:
    """Test cases for Template model."""
    
    def test_template_creation(self, app):
        """Test creating a new template."""
        with app.app_context():
            template = Template(
                title='Test Template',
                content='Test content',
                description='Test description'
            )
            db.session.add(template)
            db.session.commit()
            
            assert template.id is not None
            assert template.title == 'Test Template'
            assert template.content == 'Test content'
            assert template.description == 'Test description'
            assert template.is_favorite is False
            assert isinstance(template.created_at, datetime)
            assert isinstance(template.updated_at, datetime)
    
    def test_template_to_dict(self, app, sample_template):
        """Test template to_dict method."""
        with app.app_context():
            template_dict = sample_template.to_dict()
            
            assert 'id' in template_dict
            assert template_dict['title'] == 'Test Template'
            assert template_dict['content'] == '# Test\n\nThis is a **test** template.'
            assert template_dict['description'] == 'A test template for unit testing'
            assert template_dict['is_favorite'] is True
            assert 'created_at' in template_dict
            assert 'updated_at' in template_dict
            assert 'content_length' in template_dict
    
    def test_template_search(self, app, sample_template):
        """Test template search functionality."""
        with app.app_context():
            # Search by title
            results = Template.search('Test')
            assert len(results) >= 1
            assert any(t.title == 'Test Template' for t in results)
            
            # Search by content
            results = Template.search('test')
            assert len(results) >= 1
            
            # Search empty query
            results = Template.search('')
            assert results == []
    
    def test_template_favorites(self, app, sample_template):
        """Test getting favorite templates."""
        with app.app_context():
            favorites = Template.get_favorites()
            assert len(favorites) >= 1
            assert all(t.is_favorite for t in favorites)
    
    def test_template_recent(self, app, sample_template):
        """Test getting recent templates."""
        with app.app_context():
            recent = Template.get_recent(limit=5)
            assert len(recent) <= 5
            # Should be ordered by updated_at desc
            if len(recent) > 1:
                for i in range(len(recent) - 1):
                    assert recent[i].updated_at >= recent[i + 1].updated_at


class TestFolder:
    """Test cases for Folder model."""
    
    def test_folder_creation(self, app):
        """Test creating a new folder."""
        with app.app_context():
            folder = Folder(name='Test Folder')
            db.session.add(folder)
            db.session.commit()
            
            assert folder.id is not None
            assert folder.name == 'Test Folder'
            assert folder.parent_id is None
            assert isinstance(folder.created_at, datetime)
            assert isinstance(folder.updated_at, datetime)
    
    def test_folder_hierarchy(self, app):
        """Test folder parent-child relationships."""
        with app.app_context():
            parent_folder = Folder(name='Parent Folder')
            db.session.add(parent_folder)
            db.session.commit()
            
            child_folder = Folder(name='Child Folder', parent_id=parent_folder.id)
            db.session.add(child_folder)
            db.session.commit()
            
            assert child_folder.parent_id == parent_folder.id
            assert child_folder.parent == parent_folder
            assert child_folder in parent_folder.children
    
    def test_folder_to_dict(self, app, sample_folder):
        """Test folder to_dict method."""
        with app.app_context():
            folder_dict = sample_folder.to_dict()
            
            assert 'id' in folder_dict
            assert folder_dict['name'] == 'Test Folder'
            assert folder_dict['parent_id'] is None
            assert 'created_at' in folder_dict
            assert 'updated_at' in folder_dict
            assert 'children_count' in folder_dict
            assert 'templates_count' in folder_dict
    
    def test_folder_template_relationship(self, app, sample_folder):
        """Test folder-template relationship."""
        with app.app_context():
            template = Template(
                title='Folder Template',
                content='Content in folder',
                folder_id=sample_folder.id
            )
            db.session.add(template)
            db.session.commit()
            
            assert template.folder == sample_folder
            assert template in sample_folder.templates