"""
File system utilities for Prompt Editor v2.0

This module handles synchronization between database templates
and the file system storage in the user's directory.
"""

import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime
import re


def get_user_templates_dir() -> Path:
    """
    Get the user's templates directory path.
    
    Returns
    -------
    Path
        Path to the user's Prompt_Editor/templates/ directory
    """
    home_dir = Path.home()
    templates_dir = home_dir / "Prompt_Editor" / "templates"
    templates_dir.mkdir(parents=True, exist_ok=True)
    return templates_dir


def sanitize_folder_name(name: str) -> str:
    """
    Sanitize folder name for file system compatibility.
    
    Parameters
    ----------
    name : str
        Original folder name
        
    Returns
    -------
    str
        Sanitized folder name
    """
    # Remove or replace invalid characters for folder names
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
    sanitized = re.sub(r'_{2,}', '_', sanitized)
    sanitized = sanitized.strip('_ .')
    
    # Ensure it's not empty and not a reserved name
    reserved_names = [
        'con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5',
        'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4',
        'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
    ]
    if not sanitized or sanitized.lower() in reserved_names:
        sanitized = f"folder_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    return sanitized


def sanitize_template_filename(title: str) -> str:
    """
    Sanitize template title for filename.
    
    Parameters
    ----------
    title : str
        Template title
        
    Returns
    -------
    str
        Sanitized filename (without extension)
    """
    # Similar to folder name but for files
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', title)
    sanitized = re.sub(r'_{2,}', '_', sanitized)
    sanitized = sanitized.strip('_ .')
    
    if not sanitized:
        sanitized = f"template_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    return sanitized


def get_folder_path(
    folder_name: str, parent_path: Optional[Path] = None
) -> Path:
    """
    Get the full path for a folder.
    
    Parameters
    ----------
    folder_name : str
        Folder name
    parent_path : Path, optional
        Parent folder path, defaults to user templates directory
        
    Returns
    -------
    Path
        Full folder path
    """
    if parent_path is None:
        parent_path = get_user_templates_dir()
    
    sanitized_name = sanitize_folder_name(folder_name)
    folder_path = parent_path / sanitized_name
    return folder_path


def create_folder_on_disk(
    folder_name: str, parent_path: Optional[Path] = None
) -> Path:
    """
    Create a folder on disk.
    
    Parameters
    ----------
    folder_name : str
        Folder name to create
    parent_path : Path, optional
        Parent directory, defaults to user templates directory
        
    Returns
    -------
    Path
        Path to the created folder
    """
    folder_path = get_folder_path(folder_name, parent_path)
    folder_path.mkdir(parents=True, exist_ok=True)
    return folder_path


def save_template_to_disk(
    title: str, content: str, folder_path: Optional[Path] = None
) -> Path:
    """
    Save a template to disk as a Markdown file.
    
    Parameters
    ----------
    title : str
        Template title
    content : str
        Template content
    folder_path : Path, optional
        Folder to save in, defaults to user templates directory
        
    Returns
    -------
    Path
        Path to the saved file
    """
    if folder_path is None:
        folder_path = get_user_templates_dir()
    
    filename = sanitize_template_filename(title) + ".md"
    file_path = folder_path / filename
    
    # Add metadata header
    metadata = f"""---
title: {title}
created: {datetime.now().isoformat()}
---

"""
    
    full_content = metadata + content
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(full_content)
    
    return file_path


def delete_template_from_disk(
    title: str, folder_path: Optional[Path] = None
) -> bool:
    """
    Delete a template file from disk.
    
    Parameters
    ----------
    title : str
        Template title
    folder_path : Path, optional
        Folder path, defaults to user templates directory
        
    Returns
    -------
    bool
        True if file was deleted, False if not found
    """
    if folder_path is None:
        folder_path = get_user_templates_dir()
    
    filename = sanitize_template_filename(title) + ".md"
    file_path = folder_path / filename
    
    if file_path.exists():
        file_path.unlink()
        return True
    return False


def delete_folder_from_disk(
    folder_name: str, parent_path: Optional[Path] = None
) -> bool:
    """
    Delete a folder from disk.
    
    Parameters
    ----------
    folder_name : str
        Folder name to delete
    parent_path : Path, optional
        Parent directory, defaults to user templates directory
        
    Returns
    -------
    bool
        True if folder was deleted, False if not found
    """
    folder_path = get_folder_path(folder_name, parent_path)
    
    if folder_path.exists() and folder_path.is_dir():
        shutil.rmtree(folder_path)
        return True
    return False


def sync_database_to_filesystem():
    """
    Synchronize database content to file system.
    This can be called to ensure file system matches database.
    """
    from app.models import Template, Folder
    
    # Get all folders and create directory structure
    folders = Folder.query.all()
    folder_paths = {}
    
    # Create root folders first
    for folder in folders:
        if folder.parent_id is None:
            folder_path = create_folder_on_disk(folder.name)
            folder_paths[folder.id] = folder_path
    
    # Create child folders
    for folder in folders:
        if folder.parent_id is not None and folder.parent_id in folder_paths:
            parent_path = folder_paths[folder.parent_id]
            folder_path = create_folder_on_disk(folder.name, parent_path)
            folder_paths[folder.id] = folder_path
    
    # Save all templates to their respective folders
    templates = Template.query.all()
    for template in templates:
        if template.folder_id and template.folder_id in folder_paths:
            folder_path = folder_paths[template.folder_id]
        else:
            folder_path = get_user_templates_dir()
        
        save_template_to_disk(template.title, template.content, folder_path)


def get_folder_structure() -> dict:
    """
    Get the current folder structure from the file system.
    
    Returns
    -------
    dict
        Dictionary representing the folder structure
    """
    templates_dir = get_user_templates_dir()
    
    def scan_directory(path: Path) -> dict:
        structure = {
            'name': path.name,
            'path': str(path),
            'folders': [],
            'templates': []
        }
        
        if path.is_dir():
            for item in path.iterdir():
                if item.is_dir():
                    structure['folders'].append(scan_directory(item))
                elif item.suffix == '.md':
                    structure['templates'].append({
                        'name': item.stem,
                        'path': str(item),
                        'modified': datetime.fromtimestamp(item.stat().st_mtime)
                    })
        
        return structure
    
    return scan_directory(templates_dir)