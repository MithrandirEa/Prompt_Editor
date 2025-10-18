"""
Database models for Prompt Editor v2.0

This module defines SQLAlchemy models for storing prompt templates,
folders, and their relationships in SQLite database.
"""

from datetime import datetime
from typing import List
from sqlalchemy import Text
from app import db


class Folder(db.Model):
    """
    Model for organizing prompt templates in hierarchical folders.
    
    Attributes
    ----------
    id : int
        Primary key
    name : str
        Folder name (max 100 characters)
    parent_id : int, optional
        Parent folder ID for nested structure
    created_at : datetime
        Creation timestamp
    updated_at : datetime
        Last modification timestamp
    """
    
    __tablename__ = 'folders'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(
        db.Integer, db.ForeignKey('folders.id'), nullable=True
    )
    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    
    # Relationships
    children = db.relationship(
        'Folder',
        backref=db.backref('parent', remote_side=[id]),
        lazy='dynamic'
    )
    templates = db.relationship('Template', backref='folder', lazy='dynamic')
    
    def __repr__(self) -> str:
        return f'<Folder {self.name}>'
    
    def to_dict(self) -> dict:
        """Convert folder to dictionary representation."""
        return {
            'id': self.id,
            'name': self.name,
            'parent_id': self.parent_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'children_count': self.children.count(),
            'templates_count': self.templates.count()
        }


class Template(db.Model):
    """
    Model for storing prompt templates with markdown content.
    
    Attributes
    ----------
    id : int
        Primary key
    title : str
        Template title (max 200 characters)
    content : str
        Markdown content of the prompt
    description : str, optional
        Optional description (max 500 characters)
    folder_id : int, optional
        Parent folder ID
    is_favorite : bool
        Whether template is marked as favorite
    created_at : datetime
        Creation timestamp
    updated_at : datetime
        Last modification timestamp
    """
    
    __tablename__ = 'templates'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(Text, nullable=False, default='')
    description = db.Column(db.String(500), nullable=True)
    folder_id = db.Column(
        db.Integer, db.ForeignKey('folders.id'), nullable=True
    )
    is_favorite = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f'<Template {self.title}>'
    
    def to_dict(self) -> dict:
        """Convert template to dictionary representation."""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'description': self.description,
            'folder_id': self.folder_id,
            'is_favorite': self.is_favorite,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'content_length': len(self.content),
            'folder_name': self.folder.name if self.folder else None
        }
    
    @classmethod
    def search(cls, query: str) -> List['Template']:
        """
        Search templates by title or content.
        
        Parameters
        ----------
        query : str
            Search query string
            
        Returns
        -------
        List[Template]
            List of matching templates
        """
        if not query:
            return []
        
        search_term = f'%{query}%'
        return cls.query.filter(
            db.or_(
                cls.title.ilike(search_term),
                cls.content.ilike(search_term),
                cls.description.ilike(search_term)
            )
        ).order_by(cls.updated_at.desc()).all()
    
    @classmethod
    def get_favorites(cls) -> List['Template']:
        """
        Get all favorite templates.
        
        Returns
        -------
        List[Template]
            List of favorite templates ordered by update date
        """
        return cls.query.filter_by(is_favorite=True)\
                        .order_by(cls.updated_at.desc()).all()
    
    @classmethod
    def get_recent(cls, limit: int = 10) -> List['Template']:
        """
        Get recently updated templates.
        
        Parameters
        ----------
        limit : int
            Maximum number of templates to return
            
        Returns
        -------
        List[Template]
            List of recent templates
        """
        return cls.query.order_by(cls.updated_at.desc()).limit(limit).all()


def init_default_data() -> None:
    """Initialize database with default folders and sample templates."""
    # Create default root folder
    if not Folder.query.filter_by(name='Root', parent_id=None).first():
        root_folder = Folder(name='Root')
        db.session.add(root_folder)
        db.session.commit()
        
        # Create sample folders
        samples_folder = Folder(
            name='Sample Templates', parent_id=root_folder.id
        )
        work_folder = Folder(name='Work Templates', parent_id=root_folder.id)
        db.session.add_all([samples_folder, work_folder])
        db.session.commit()
        
        # Create sample template
        sample_template = Template(
            title='Welcome Template',
            content="""# Welcome to Prompt Editor v2.0

This is a **sample template** to get you started.

## Features

- Markdown editing with live preview
- Template organization in folders
- Export to `.md` and `.txt` formats
- Search and favorites functionality

### Getting Started

1. Create new templates using the editor
2. Organize them in folders
3. Export when ready

*Happy prompting!*""",
            description='A sample template demonstrating markdown features',
            folder_id=samples_folder.id,
            is_favorite=True
        )
        db.session.add(sample_template)
        db.session.commit()