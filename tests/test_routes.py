"""
Unit tests for Flask routes and API endpoints.

This module tests all HTTP endpoints including template management,
folder operations, and export functionality.
"""

import json


class TestRoutes:
    """Test cases for main routes."""
    
    def test_index_route(self, client):
        """Test main index page."""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Prompt Editor v2.0' in response.data
    
    def test_get_templates_api(self, client, sample_template):
        """Test getting templates via API."""
        response = client.get('/api/templates')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'data' in data
        assert len(data['data']) >= 1
    
    def test_create_template_api(self, client):
        """Test creating template via API."""
        template_data = {
            'title': 'New Test Template',
            'content': 'New test content',
            'description': 'Created via API'
        }
        
        response = client.post(
            '/api/templates',
            data=json.dumps(template_data),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['data']['title'] == 'New Test Template'
    
    def test_create_template_missing_title(self, client):
        """Test creating template without title fails."""
        template_data = {
            'content': 'Content without title'
        }
        
        response = client.post(
            '/api/templates',
            data=json.dumps(template_data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
    
    def test_get_template_by_id(self, client, sample_template):
        """Test getting specific template by ID."""
        response = client.get(f'/api/templates/{sample_template.id}')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['data']['id'] == sample_template.id
        assert data['data']['title'] == sample_template.title
    
    def test_get_nonexistent_template(self, client):
        """Test getting nonexistent template returns 404."""
        response = client.get('/api/templates/99999')
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert data['status'] == 'error'
    
    def test_update_template(self, client, sample_template):
        """Test updating template via API."""
        update_data = {
            'title': 'Updated Template Title',
            'content': 'Updated content',
            'is_favorite': False
        }
        
        response = client.put(
            f'/api/templates/{sample_template.id}',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['data']['title'] == 'Updated Template Title'
        assert data['data']['is_favorite'] is False
    
    def test_delete_template(self, client, sample_template):
        """Test deleting template via API."""
        template_id = sample_template.id
        
        response = client.delete(f'/api/templates/{template_id}')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        
        # Verify template is deleted
        response = client.get(f'/api/templates/{template_id}')
        assert response.status_code == 404
    
    def test_get_folders_api(self, client, sample_folder):
        """Test getting folders via API."""
        response = client.get('/api/folders')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert len(data['data']) >= 1
    
    def test_create_folder_api(self, client):
        """Test creating folder via API."""
        folder_data = {
            'name': 'New Test Folder'
        }
        
        response = client.post(
            '/api/folders',
            data=json.dumps(folder_data),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['data']['name'] == 'New Test Folder'
    
    def test_create_folder_missing_name(self, client):
        """Test creating folder without name fails."""
        folder_data = {}
        
        response = client.post(
            '/api/folders',
            data=json.dumps(folder_data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
    
    def test_search_templates(self, client, sample_template):
        """Test searching templates."""
        response = client.get('/api/templates?search=test')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert len(data['data']) >= 1
    
    def test_filter_favorites(self, client, sample_template):
        """Test filtering favorite templates."""
        response = client.get('/api/templates?favorites=true')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        # All returned templates should be favorites
        for template in data['data']:
            assert template['is_favorite'] is True
    
    def test_filter_by_folder(self, client, sample_folder):
        """Test filtering templates by folder."""
        # Create template in folder
        template_data = {
            'title': 'Folder Template',
            'content': 'Content in folder',
            'folder_id': sample_folder.id
        }
        
        response = client.post(
            '/api/templates',
            data=json.dumps(template_data),
            content_type='application/json'
        )
        assert response.status_code == 201
        
        # Filter by folder
        response = client.get(f'/api/templates?folder_id={sample_folder.id}')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert len(data['data']) >= 1
        # All returned templates should be in the folder
        for template in data['data']:
            assert template['folder_id'] == sample_folder.id