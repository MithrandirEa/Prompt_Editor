# API Documentation

## Overview

Prompt Editor v2.0 provides a comprehensive REST API for managing templates and folders.

## Base URL

```
http://localhost:5000/api
```

## Authentication

Currently, no authentication is required for API access.

## Endpoints

### Templates

#### GET /api/templates
Get all templates with optional filtering.

**Query Parameters:**
- `recent=true` - Get recently modified templates
- `favorites=true` - Get favorite templates
- `search=<query>` - Search templates by content

**Response:**
```json
[
  {
    "id": 1,
    "title": "Template Title",
    "content": "Template content...",
    "folder_id": null,
    "is_favorite": false,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  }
]
```

#### GET /api/templates/:id
Get a specific template by ID.

#### POST /api/templates
Create a new template.

**Request Body:**
```json
{
  "title": "New Template",
  "content": "Template content...",
  "folder_id": null
}
```

#### PATCH /api/templates/:id
Update an existing template.

#### DELETE /api/templates/:id
Delete a template.

### Folders

#### GET /api/folders
Get all folders.

#### GET /api/folders/:id/templates
Get all templates in a specific folder.

#### POST /api/folders
Create a new folder.

**Request Body:**
```json
{
  "name": "Folder Name",
  "parent_id": null
}
```

#### DELETE /api/folders/:id
Delete a folder and optionally its contents.

### Synchronization

#### POST /api/sync/filesystem
Synchronize templates from the filesystem.

**Request Body:**
```json
{
  "path": "/path/to/templates"
}
```

## Error Responses

All endpoints return standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

Error responses include a JSON object with error details:

```json
{
  "error": "Error message",
  "status": 400
}
```