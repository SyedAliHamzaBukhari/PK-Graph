# Personal Knowledge Graph Backend

## Overview

This is the Node.js backend API for the Personal Knowledge Graph system. It provides RESTful endpoints for managing concepts, notes, relationships, and graph operations.

## Features

### Core API Endpoints
- **Concepts**: CRUD operations for knowledge concepts
- **Notes**: Manage notes attached to concepts
- **Links**: Create and manage relationships between concepts
- **Search**: Full-text search with advanced filtering
- **Graph**: Graph traversal, visualization, and analysis
- **Analytics**: Usage analytics and graph metrics

### Advanced Features
- Graph visualization using Cytoscape.js
- AI-powered content analysis using z-ai-web-dev-sdk
- Real-time graph traversal algorithms
- Performance monitoring and logging
- Rate limiting and security

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Documentation

### Concepts

#### GET /api/concepts
Get all concepts with optional filtering.

Query Parameters:
- `type`: Filter by concept type
- `search`: Search in name and description
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)
- `sortBy`: Sort field (name, type, created_at, updated_at)
- `sortOrder`: Sort direction (ASC, DESC)

#### GET /api/concepts/:id
Get specific concept with details, notes, and connections.

#### POST /api/concepts
Create a new concept.

Body:
```json
{
  "name": "Concept Name",
  "description": "Concept description",
  "type": "concept"
}
```

#### PUT /api/concepts/:id
Update an existing concept.

#### DELETE /api/concepts/:id
Delete a concept (cascades to notes and links).

### Search

#### POST /api/search/concepts
Full-text search for concepts.

Body:
```json
{
  "query": "search term",
  "type": "concept",
  "limit": 20,
  "offset": 0
}
```

#### POST /api/search/notes
Advanced note search with filtering.

Body:
```json
{
  "query": "search term",
  "conceptId": 1,
  "importanceMin": 0.5,
  "importanceMax": 1.0,
  "tagIds": "1,2,3",
  "limit": 20,
  "offset": 0
}
```

#### GET /api/search/suggestions
Get popular and recent search suggestions.

#### GET /api/search/autocomplete
Autocomplete for concept names.

### Graph Operations

#### GET /api/graph/visualization/:conceptId
Get graph visualization data for Cytoscape.js.

Query Parameters:
- `depth`: Depth of graph traversal (default: 2)

#### POST /api/graph/paths/shortest
Find shortest path between concepts.

Body:
```json
{
  "sourceId": 1,
  "targetId": 5,
  "maxHops": 5
}
```

#### POST /api/graph/connections/n-hop
Find N-hop connections from a concept.

Body:
```json
{
  "conceptId": 1,
  "maxHops": 3,
  "relationshipType": "related_to",
  "minStrength": 0.5
}
```

#### GET /api/graph/components
Get connected components of the graph.

#### GET /api/graph/influential
Get influential concepts (hubs and authorities).

#### GET /api/graph/export
Export graph data in various formats.

Query Parameters:
- `format`: Export format (json, gexf, graphml)

### AI Analysis

#### POST /api/ai/analyze-content
Analyze content using AI.

Body:
```json
{
  "content": "Text to analyze",
  "analysisType": "summary|keywords|sentiment"
}
```

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message",
  "requestId": "unique-request-id"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "requestId": "unique-request-id"
}
```

## Database Integration

The backend integrates with the MySQL database through stored procedures for optimal performance:

- `create_concept`, `update_concept`, `delete_concept`
- `search_concepts`, `search_notes`
- `find_n_hop_connections`, `find_shortest_path`
- `calculate_concept_similarity`
- `get_concept_statistics`, `get_graph_overview`

## Graph Visualization

The backend provides data formatted for Cytoscape.js:

```json
{
  "nodes": [
    {
      "data": {
        "id": "1",
        "label": "Concept Name",
        "type": "concept"
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "1-2",
        "source": "1",
        "target": "2",
        "label": "related_to",
        "strength": 0.8
      }
    }
  ]
}
```

## Error Handling

- Comprehensive error logging with Winston
- Request tracking with unique IDs
- Graceful error responses
- Database connection pooling with retry logic

## Security

- Rate limiting (100 requests per 15 minutes)
- CORS configuration
- Input validation with Joi
- SQL injection prevention
- Helmet.js for security headers

## Performance

- Connection pooling
- Query optimization
- Response compression
- Request caching where appropriate
- Performance monitoring

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Environment Variables
See `.env.example` for all available configuration options.

## Deployment

The backend is designed to run on port 3001 and can be deployed using:

- PM2 for process management
- Docker containers
- Cloud platforms (AWS, Google Cloud, Azure)

## Monitoring

- Request logging with Morgan
- Error tracking with Winston
- Database connection monitoring
- Performance metrics collection

## License

MIT License