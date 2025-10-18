"""
Export utilities for Prompt Editor v2.0

This module provides functions to export templates in different formats
including Markdown and plain text with proper formatting.
"""

import re
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Template


def export_to_markdown(template: 'Template') -> str:
    """
    Export template as formatted Markdown file.
    
    Parameters
    ----------
    template : Template
        Template instance to export
        
    Returns
    -------
    str
        Formatted Markdown content with metadata header
    """
    # Create metadata header
    metadata = f"""---
title: "{template.title}"
description: "{template.description or ''}"
created: {template.created_at.strftime('%Y-%m-%d %H:%M:%S')}
updated: {template.updated_at.strftime('%Y-%m-%d %H:%M:%S')}
folder: "{template.folder.name if template.folder else 'Root'}"
favorite: {str(template.is_favorite).lower()}
exported: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
---

"""
    
    # Add title if not already in content
    content = template.content
    if not content.strip().startswith('#'):
        content = f"# {template.title}\n\n{content}"
    
    return metadata + content


def export_to_text(template: 'Template') -> str:
    """
    Export template as plain text file with markdown formatting removed.
    
    Parameters
    ----------
    template : Template
        Template instance to export
        
    Returns
    -------
    str
        Plain text content with metadata header
    """
    # Create text metadata header
    header = f"""PROMPT TEMPLATE
===============

Title: {template.title}
Description: {template.description or 'No description'}
Created: {template.created_at.strftime('%Y-%m-%d %H:%M:%S')}
Updated: {template.updated_at.strftime('%Y-%m-%d %H:%M:%S')}
Folder: {template.folder.name if template.folder else 'Root'}
Favorite: {'Yes' if template.is_favorite else 'No'}
Exported: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

{"="*50}

"""
    
    # Convert markdown to plain text
    content = markdown_to_text(template.content)
    
    return header + content


def markdown_to_text(markdown_content: str) -> str:
    """
    Convert Markdown content to plain text by removing formatting.
    
    Parameters
    ----------
    markdown_content : str
        Markdown formatted text
        
    Returns
    -------
    str
        Plain text with markdown formatting removed
    """
    if not markdown_content:
        return ""
    
    text = markdown_content
    
    # Remove headers (convert to uppercase)
    text = re.sub(
        r'^#{1,6}\s*(.+)$',
        lambda m: m.group(1).upper(),
        text,
        flags=re.MULTILINE
    )
    
    # Remove bold/italic formatting
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'\1', text)  # Bold italic
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)      # Bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)          # Italic
    text = re.sub(r'__(.+?)__', r'\1', text)          # Bold alt
    text = re.sub(r'_(.+?)_', r'\1', text)            # Italic alt
    
    # Remove inline code formatting
    text = re.sub(r'`(.+?)`', r'\1', text)
    
    # Convert code blocks to indented text
    text = re.sub(r'^```.*?\n', '', text, flags=re.MULTILINE)
    text = re.sub(r'^```$', '', text, flags=re.MULTILINE)
    
    # Remove link formatting but keep URL
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', text)
    
    # Convert blockquotes to simple format
    text = re.sub(r'^>\s*(.+)$', r'"\1"', text, flags=re.MULTILINE)
    
    # Convert unordered lists
    text = re.sub(r'^[\*\-\+]\s+(.+)$', r'• \1', text, flags=re.MULTILINE)
    
    # Convert ordered lists (keep numbering)
    text = re.sub(
        r'^\d+\.\s+(.+)$',
        lambda m: f'{m.group(0)}',
        text,
        flags=re.MULTILINE
    )
    
    # Remove horizontal rules
    text = re.sub(r'^[\-\*_]{3,}$', '', text, flags=re.MULTILINE)
    
    # Clean up multiple empty lines
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    return text


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing invalid characters.
    
    Parameters
    ----------
    filename : str
        Original filename
        
    Returns
    -------
    str
        Sanitized filename safe for filesystem
    """
    # Remove or replace invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Remove multiple underscores
    filename = re.sub(r'_{2,}', '_', filename)
    
    # Remove leading/trailing underscores and spaces
    filename = filename.strip('_ ')
    
    # Ensure filename is not empty
    if not filename:
        filename = 'untitled'
    
    # Limit length
    if len(filename) > 100:
        filename = filename[:100]
    
    return filename


def get_export_stats(template: 'Template') -> dict:
    """
    Get statistics about template content for export.
    
    Parameters
    ----------
    template : Template
        Template instance to analyze
        
    Returns
    -------
    dict
        Dictionary containing content statistics
    """
    content = template.content or ""
    
    # Count lines
    lines = content.split('\n')
    total_lines = len(lines)
    non_empty_lines = len([line for line in lines if line.strip()])
    
    # Count words and characters
    words = len(content.split())
    characters = len(content)
    characters_no_spaces = len(content.replace(' ', ''))
    
    # Count markdown elements
    headers = len(re.findall(r'^#{1,6}\s', content, re.MULTILINE))
    bold_text = len(re.findall(r'\*\*[^*]+\*\*', content))
    italic_text = len(re.findall(r'\*[^*]+\*', content))
    code_blocks = len(re.findall(r'```', content)) // 2
    inline_code = len(re.findall(r'`[^`]+`', content))
    links = len(re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content))
    lists = len(re.findall(r'^[\*\-\+\d+\.]\s', content, re.MULTILINE))
    
    return {
        'total_lines': total_lines,
        'non_empty_lines': non_empty_lines,
        'words': words,
        'characters': characters,
        'characters_no_spaces': characters_no_spaces,
        'headers': headers,
        'bold_text': bold_text,
        'italic_text': italic_text,
        'code_blocks': code_blocks,
        'inline_code': inline_code,
        'links': links,
        'lists': lists,
        'estimated_reading_time': max(1, words // 200)  # ~200 words per minute
    }