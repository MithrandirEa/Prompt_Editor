"""
Unit tests for export utilities.

This module tests the export functionality including Markdown and
plain text conversion, filename sanitization, and content statistics.
"""

from app.models import Template
from app.utils.export import (
    export_to_markdown, export_to_text, markdown_to_text,
    sanitize_filename, get_export_stats
)


class TestExportUtilities:
    """Test cases for export utilities."""
    
    def test_export_to_markdown(self, app, sample_template):
        """Test exporting template to Markdown format."""
        with app.app_context():
            markdown = export_to_markdown(sample_template)
            
            assert '---' in markdown  # YAML frontmatter
            assert f'title: "{sample_template.title}"' in markdown
            assert sample_template.content in markdown
            assert 'exported:' in markdown
    
    def test_export_to_text(self, app, sample_template):
        """Test exporting template to plain text format."""
        with app.app_context():
            text = export_to_text(sample_template)
            
            assert 'PROMPT TEMPLATE' in text
            assert f'Title: {sample_template.title}' in text
            assert 'TEST' in text.upper()  # Headers converted to uppercase
            assert 'test' in text.lower()  # Content converted
    
    def test_markdown_to_text_headers(self):
        """Test converting Markdown headers to text."""
        markdown = "# Header 1\n## Header 2\n### Header 3"
        text = markdown_to_text(markdown)
        
        assert "HEADER 1" in text
        assert "HEADER 2" in text
        assert "HEADER 3" in text
        assert "#" not in text
    
    def test_markdown_to_text_formatting(self):
        """Test removing Markdown formatting."""
        markdown = "**Bold** and *italic* and `code`"
        text = markdown_to_text(markdown)
        
        assert text == "Bold and italic and code"
    
    def test_markdown_to_text_lists(self):
        """Test converting Markdown lists."""
        markdown = "- Item 1\n- Item 2\n1. First\n2. Second"
        text = markdown_to_text(markdown)
        
        assert "• Item 1" in text
        assert "• Item 2" in text
        assert "1. First" in text
        assert "2. Second" in text
    
    def test_markdown_to_text_quotes(self):
        """Test converting blockquotes."""
        markdown = "> This is a quote\n> Another line"
        text = markdown_to_text(markdown)
        
        assert '"This is a quote"' in text
        assert '"Another line"' in text
    
    def test_markdown_to_text_links(self):
        """Test converting links."""
        markdown = "[Google](https://google.com) and [GitHub](https://github.com)"
        text = markdown_to_text(markdown)
        
        assert "Google (https://google.com)" in text
        assert "GitHub (https://github.com)" in text
    
    def test_sanitize_filename_invalid_chars(self):
        """Test filename sanitization with invalid characters."""
        filename = 'file<>:"/\\|?*name'
        sanitized = sanitize_filename(filename)
        
        assert sanitized == "file_name"
    
    def test_sanitize_filename_empty(self):
        """Test sanitizing empty filename."""
        sanitized = sanitize_filename("")
        assert sanitized == "untitled"
    
    def test_sanitize_filename_long(self):
        """Test sanitizing very long filename."""
        long_name = "a" * 150
        sanitized = sanitize_filename(long_name)
        
        assert len(sanitized) <= 100
    
    def test_get_export_stats(self, app, sample_template):
        """Test getting export statistics."""
        with app.app_context():
            stats = get_export_stats(sample_template)
            
            assert 'total_lines' in stats
            assert 'words' in stats
            assert 'characters' in stats
            assert 'headers' in stats
            assert 'bold_text' in stats
            assert 'estimated_reading_time' in stats
            
            # Should detect at least one header and one bold text
            assert stats['headers'] >= 1
            assert stats['bold_text'] >= 1
    
    def test_get_export_stats_empty_content(self, app):
        """Test statistics for empty content."""
        with app.app_context():
            template = Template(title="Empty", content="")
            stats = get_export_stats(template)
            
            assert stats['words'] == 0
            assert stats['characters'] == 0
            assert stats['headers'] == 0
            assert stats['estimated_reading_time'] == 1  # Minimum 1 minute