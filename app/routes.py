"""
Flask routes for Prompt Editor v2.0

This module defines all the HTTP endpoints for the application,
including the main interface, template management, and export functionality.
"""

from flask import (
    Blueprint, render_template, request, jsonify, redirect, url_for,
    flash, send_file, current_app
)
from werkzeug.exceptions import BadRequest, NotFound
import tempfile
from app import db
from app.models import Template, Folder, init_default_data
from app.utils.export import export_to_markdown, export_to_text
from app.utils.filesystem import (
    save_template_to_disk, delete_template_from_disk, create_folder_on_disk,
    delete_folder_from_disk, get_user_templates_dir, sync_database_to_filesystem
)

# Create blueprint
main = Blueprint('main', __name__)


@main.route('/')
def index():
    """
    Main application interface with editor and template manager tabs.
    
    Returns
    -------
    str
        Rendered HTML template
    """
    # Initialize default data if database is empty
    if Template.query.count() == 0:
        init_default_data()
    
    # Get recent templates and folders for initial load
    recent_templates = Template.get_recent(limit=5)
    folders = Folder.query.all()
    
    return render_template(
        'index.html',
        recent_templates=recent_templates,
        folders=folders
    )


@main.route('/api/templates', methods=['GET'])
def get_templates():
    """
    Get all templates with optional filtering.
    
    Query Parameters
    ----------------
    folder_id : int, optional
        Filter by folder ID
    search : str, optional
        Search query
    favorites : bool, optional
        Filter favorites only
    
    Returns
    -------
    JSON
        List of templates with metadata
    """
    try:
        folder_id = request.args.get('folder_id', type=int)
        search_query = request.args.get('search', '').strip()
        favorites_only = request.args.get('favorites', '').lower() == 'true'
        
        query = Template.query
        
        if folder_id:
            query = query.filter_by(folder_id=folder_id)
        
        if search_query:
            templates = Template.search(search_query)
        elif favorites_only:
            templates = Template.get_favorites()
        else:
            templates = query.order_by(Template.updated_at.desc()).all()
        
        return jsonify({
            'status': 'success',
            'data': [template.to_dict() for template in templates],
            'count': len(templates)
        })
    
    except Exception as e:
        current_app.logger.error(f'Error fetching templates: {str(e)}')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/templates', methods=['POST'])
def create_template():
    """
    Create a new template.
    
    JSON Body
    ---------
    title : str
        Template title
    content : str, optional
        Markdown content
    description : str, optional
        Template description
    folder_id : int, optional
        Parent folder ID
    
    Returns
    -------
    JSON
        Created template data
    """
    try:
        data = request.get_json()
        if not data or not data.get('title'):
            raise BadRequest('Title is required')
        
        template = Template(
            title=data['title'],
            content=data.get('content', ''),
            description=data.get('description', ''),
            folder_id=data.get('folder_id')
        )
        
        db.session.add(template)
        db.session.commit()
        
        # Save to file system
        try:
            save_template_to_disk(template.title, template.content)
        except Exception as e:
            msg = f'Failed to save template to disk: {str(e)}'
            current_app.logger.warning(msg)
        
        current_app.logger.info(f'Created template: {template.title}')
        return jsonify({
            'status': 'success',
            'data': template.to_dict()
        }), 201
    
    except BadRequest as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating template: {str(e)}')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/templates/<int:template_id>', methods=['GET'])
def get_template(template_id):
    """
    Get specific template by ID.
    
    Parameters
    ----------
    template_id : int
        Template ID
    
    Returns
    -------
    JSON
        Template data
    """
    try:
        template = Template.query.get_or_404(template_id)
        return jsonify({
            'status': 'success',
            'data': template.to_dict()
        })
    
    except NotFound:
        msg = {'status': 'error', 'message': 'Template not found'}
        return jsonify(msg), 404
    except Exception as e:
        error_msg = f'Error fetching template {template_id}: {str(e)}'
        current_app.logger.error(error_msg)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/templates/<int:template_id>', methods=['PUT'])
def update_template(template_id):
    """
    Update existing template.
    
    Parameters
    ----------
    template_id : int
        Template ID
    
    JSON Body
    ---------
    title : str, optional
        Updated title
    content : str, optional
        Updated content
    description : str, optional
        Updated description
    folder_id : int, optional
        Updated folder ID
    is_favorite : bool, optional
        Updated favorite status
    
    Returns
    -------
    JSON
        Updated template data
    """
    try:
        template = Template.query.get_or_404(template_id)
        data = request.get_json()
        
        if not data:
            raise BadRequest('No data provided')
        
        # Update fields if provided
        if 'title' in data:
            template.title = data['title']
        if 'content' in data:
            template.content = data['content']
        if 'description' in data:
            template.description = data['description']
        if 'folder_id' in data:
            template.folder_id = data['folder_id']
        if 'is_favorite' in data:
            template.is_favorite = data['is_favorite']
        
        db.session.commit()
        
        # Update file on disk
        try:
            save_template_to_disk(template.title, template.content)
        except Exception as e:
            msg = f'Failed to update template on disk: {str(e)}'
            current_app.logger.warning(msg)
        
        current_app.logger.info(f'Updated template: {template.title}')
        return jsonify({
            'status': 'success',
            'data': template.to_dict()
        })
    
    except NotFound:
        msg = {'status': 'error', 'message': 'Template not found'}
        return jsonify(msg), 404
    except BadRequest as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        error_msg = f'Error updating template {template_id}: {str(e)}'
        current_app.logger.error(error_msg)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/templates/<int:template_id>', methods=['DELETE'])
def delete_template(template_id):
    """
    Delete template by ID.
    
    Parameters
    ----------
    template_id : int
        Template ID
    
    Returns
    -------
    JSON
        Success message
    """
    try:
        template = Template.query.get_or_404(template_id)
        title = template.title
        
        db.session.delete(template)
        db.session.commit()
        
        # Delete file from disk
        try:
            delete_template_from_disk(template.title)
        except Exception as e:
            msg = f'Failed to delete template from disk: {str(e)}'
            current_app.logger.warning(msg)
        
        current_app.logger.info(f'Deleted template: {template.title}')
        return jsonify({
            'status': 'success',
            'message': f'Template "{title}" deleted successfully'
        })
    
    except NotFound:
        msg = {'status': 'error', 'message': 'Template not found'}
        return jsonify(msg), 404
    except Exception as e:
        db.session.rollback()
        error_msg = f'Error deleting template {template_id}: {str(e)}'
        current_app.logger.error(error_msg)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/templates/<int:template_id>/favorite', methods=['PUT'])
def toggle_template_favorite(template_id):
    """
    Toggle template favorite status.
    
    Parameters
    ----------
    template_id : int
        Template ID
    
    JSON Body
    ---------
    is_favorite : bool
        New favorite status
    
    Returns
    -------
    JSON
        Updated template data
    """
    try:
        template = Template.query.get_or_404(template_id)
        data = request.get_json()
        
        if not data or 'is_favorite' not in data:
            raise BadRequest('is_favorite field is required')
        
        template.is_favorite = data['is_favorite']
        db.session.commit()
        
        current_app.logger.info(
            f'Updated favorite status for template: {template.title} '
            f'to {template.is_favorite}'
        )
        return jsonify({
            'status': 'success',
            'data': template.to_dict()
        })
    
    except NotFound:
        msg = {'status': 'error', 'message': 'Template not found'}
        return jsonify(msg), 404
    except BadRequest as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        error_msg = (
            f'Error updating favorite status for template {template_id}: '
            f'{str(e)}'
        )
        current_app.logger.error(error_msg)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/folders', methods=['GET'])
def get_folders():
    """
    Get all folders in hierarchical structure.
    
    Returns
    -------
    JSON
        List of folders with children
    """
    try:
        folders = Folder.query.all()
        return jsonify({
            'status': 'success',
            'data': [folder.to_dict() for folder in folders]
        })
    
    except Exception as e:
        current_app.logger.error(f'Error fetching folders: {str(e)}')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/folders', methods=['POST'])
def create_folder():
    """
    Create a new folder.
    
    JSON Body
    ---------
    name : str
        Folder name
    parent_id : int, optional
        Parent folder ID
    
    Returns
    -------
    JSON
        Created folder data
    """
    try:
        data = request.get_json()
        if not data or not data.get('name'):
            raise BadRequest('Folder name is required')
        
        folder = Folder(
            name=data['name'],
            parent_id=data.get('parent_id')
        )
        
        db.session.add(folder)
        db.session.commit()
        
        current_app.logger.info(f'Created folder: {folder.name}')
        return jsonify({
            'status': 'success',
            'data': folder.to_dict()
        }), 201
    
    except BadRequest as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating folder: {str(e)}')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/folders/<int:folder_id>', methods=['PUT'])
def update_folder(folder_id):
    """
    Update existing folder.
    
    Parameters
    ----------
    folder_id : int
        Folder ID
    
    JSON Body
    ---------
    name : str, optional
        Updated folder name
    parent_id : int, optional
        Updated parent folder ID
    
    Returns
    -------
    JSON
        Updated folder data
    """
    try:
        folder = Folder.query.get_or_404(folder_id)
        data = request.get_json()
        
        if not data:
            raise BadRequest('No data provided')
        
        # Update fields if provided
        if 'name' in data:
            folder.name = data['name']
        if 'parent_id' in data:
            # Check for circular dependency
            if data['parent_id'] == folder_id:
                raise BadRequest('Folder cannot be its own parent')
            
            # Check if new parent would create circular dependency
            def would_create_circle(check_folder_id, target_parent_id):
                if check_folder_id == target_parent_id:
                    return True
                parent = Folder.query.get(target_parent_id)
                if parent and parent.parent_id:
                    return would_create_circle(
                        check_folder_id, parent.parent_id
                    )
                return False
            
            if (data['parent_id'] and
                    would_create_circle(folder_id, data['parent_id'])):
                raise BadRequest(
                    'This would create a circular folder dependency'
                )
            
            folder.parent_id = data['parent_id']
        
        db.session.commit()
        
        current_app.logger.info(f'Updated folder: {folder.name}')
        return jsonify({
            'status': 'success',
            'data': folder.to_dict()
        })
    
    except BadRequest as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except NotFound:
        return jsonify({'status': 'error', 'message': 'Folder not found'}), 404
    except Exception as e:
        db.session.rollback()
        error_msg = f'Error updating folder {folder_id}: {str(e)}'
        current_app.logger.error(error_msg)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/export/md/<int:template_id>')
def export_markdown(template_id):
    """
    Export template as markdown file.
    
    Parameters
    ----------
    template_id : int
        Template ID
    
    Returns
    -------
    File
        Downloadable .md file
    """
    try:
        template = Template.query.get_or_404(template_id)
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.md', delete=False, encoding='utf-8'
        ) as tmp_file:
            content = export_to_markdown(template)
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        filename = f"{template.title.replace(' ', '_')}.md"
        
        return send_file(
            tmp_path,
            as_attachment=True,
            download_name=filename,
            mimetype='text/markdown'
        )
    
    except NotFound:
        flash('Template not found', 'error')
        return redirect(url_for('main.index'))
    except Exception as e:
        current_app.logger.error(f'Error exporting markdown: {str(e)}')
        flash('Export failed', 'error')
        return redirect(url_for('main.index'))


@main.route('/export/txt/<int:template_id>')
def export_text(template_id):
    """
    Export template as plain text file.
    
    Parameters
    ----------
    template_id : int
        Template ID
    
    Returns
    -------
    File
        Downloadable .txt file
    """
    try:
        template = Template.query.get_or_404(template_id)
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.txt', delete=False, encoding='utf-8'
        ) as tmp_file:
            content = export_to_text(template)
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        filename = f"{template.title.replace(' ', '_')}.txt"
        
        return send_file(
            tmp_path,
            as_attachment=True,
            download_name=filename,
            mimetype='text/plain'
        )
    
    except NotFound:
        flash('Template not found', 'error')
        return redirect(url_for('main.index'))
    except Exception as e:
        current_app.logger.error(f'Error exporting text: {str(e)}')
        flash('Export failed', 'error')
        return redirect(url_for('main.index'))


@main.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors."""
    return jsonify({'status': 'error', 'message': 'Resource not found'}), 404


@main.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    db.session.rollback()
    msg = {'status': 'error', 'message': 'Internal server error'}
    return jsonify(msg), 500


def initialize_filesystem_sync():
    """Initialize filesystem synchronization on app startup."""
    try:
        sync_database_to_filesystem()
        current_app.logger.info('Filesystem sync completed successfully')
    except Exception as e:
        error_msg = f'Filesystem sync failed: {str(e)}'
        current_app.logger.error(error_msg)


# Initialize sync when the module is imported
try:
    from flask import has_app_context
    if has_app_context():
        initialize_filesystem_sync()
except Exception:
    # Will be handled when app context is available
    pass