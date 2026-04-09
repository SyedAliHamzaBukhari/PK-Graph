# Personal Knowledge Graph (PKG)

A comprehensive, database-heavy project implementing a personal knowledge management system with graph-based relationships between concepts, notes, and sources.

### Key Features

This project demonstrates advanced database design, full-stack development, and knowledge graph visualization. It implements a complete Personal Knowledge Graph system that allows users to create, manage, and explore interconnected knowledge through concepts, notes, tags, sources, and relationships.

#### Database Layer
- **Advanced Schema Design**: Normalized 3NF database with 10+ tables
- **Full-Text Search**: MySQL full-text search with relevance scoring
- **Stored Procedures**: 20+ stored procedures for complex operations
- **Triggers**: Automated data maintenance and consistency
- **Recursive Queries**: N-hop graph traversal and shortest path algorithms
- **Performance Optimization**: Comprehensive indexing and materialized views
- **Analytics**: Query tracking, graph metrics, and performance monitoring

#### Backend API
- **RESTful API**: Node.js/Express with comprehensive endpoints
- **Graph Algorithms**: Cytoscape.js integration for visualization
- **Security**: Rate limiting, CORS, input validation
- **Performance**: Connection pooling, compression, caching

#### Frontend Interface
- **Modern UI**: React with shadcn/ui components
- **Graph Visualization**: Interactive knowledge graph display
- **Search & Analytics**: Advanced search and real-time analytics
- **Responsive Design**: Mobile-first responsive interface

## Project Structure

```
personal-knowledge-graph/
├── database/                    # Database implementation
│   ├── schema/                  # Database schema and DDL
│   │   ├── 01_core_schema.sql
│   │   ├── 02_complete_ddl.sql
│   │   └── 03_indexes_fulltext.sql
│   ├── procedures/              # Stored procedures
│   │   ├── 01_core_procedures.sql
│   │   ├── 02_unit_tests.sql
│   │   ├── 03_recursive_similarity.sql
│   │   └── 04_materialized_views.sql
│   ├── triggers/                # Database triggers
│   │   └── 01_maintenance_triggers.sql
│   ├── seeds/                   # Sample data and tests
│   │   ├── 01_comprehensive_seed_data.sql
│   │   └── 02_sanity_tests.sql
│   ├── scripts/                 # Performance and analytics
│   │   ├── 01_performance_analytics.sql
│   │   └── 02_performance_tests.sql
│   ├── setup_complete.sql       # Complete database setup
│   ├── personal_knowledge_graph_dump.sql
│   └── README.md
├── backend/                     # Node.js backend API
│   ├── config/                  # Configuration files
│   │   └── database.js
│   ├── routes/                  # API routes
│   │   ├── concepts.js
│   │   ├── notes.js
│   │   ├── links.js
│   │   ├── search.js
│   │   ├── graph.js
│   │   └── analytics.js
│   ├── utils/                   # Utility functions
│   │   └── graphUtils.js
│   ├── middleware/              # Express middleware
│   ├── logs/                    # Log files
│   ├── package.json
│   ├── server.js
│   ├── .env.example
│   └── README.md
├── src/                         # React frontend
│   ├── app/                     # Next.js app directory
│   │   ├── page.tsx            # Main application page
│   │   └── layout.tsx
│   ├── components/              # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   └── SimpleGraph.tsx     # Graph visualization
│   └── lib/                    # Utility libraries
├── docs/                        # Documentation
├── deploy.sh                    # Deployment script
├── README.md                    # This file
└── package.json                 # Root package.json
```

## Technology Stack

### Database
- **MySQL 8.0+**: Primary database with advanced features
- **Stored Procedures**: Complex business logic in database
- **Full-Text Search**: Natural language search with relevance scoring
- **Recursive CTEs**: Graph traversal algorithms

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MySQL2**: Database driver with connection pooling
- **Joi**: Input validation
- **Winston**: Logging
- **Cytoscape.js**: Graph visualization library

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Modern UI component library
- **Lucide React**: Icon library

## Database Schema

### Core Tables

#### Concepts
Primary entities in the knowledge graph (people, places, ideas, etc.)
- Relationships: One-to-many with Notes, many-to-many through Links

#### Notes
Detailed information attached to concepts
- Features: Importance scoring, source tracking, privacy controls
- Relationships: Many-to-many with Tags and Sources

#### Links
Relationships between concepts
- Features: Typed relationships, strength scoring, bidirectional support
- Types: related_to, part_of, similar_to, causes, enables, requires, contradicts, example_of

#### Tags & Sources
Flexible categorization and citation system
- Features: Usage tracking, credibility scoring, metadata support

### Analytics Tables
- **concept_summaries**: Materialized views for performance
- **query_history**: Search analytics and performance tracking
- **graph_metrics**: Daily graph statistics

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- MySQL 8.0+ or MariaDB 10.5+
- Git

### 1. Clone and Setup
```bash
git clone <https://github.com/SyedAliHamzaBukhari/PK-Graph>
cd personal-knowledge-graph
```

### 2. Database Setup
```bash
# Option 1: Use the automated setup script
chmod +x deploy.sh
./deploy.sh --with-sample-data

# Option 2: Manual setup
mysql -u root -p < database/setup_complete.sql
mysql -u root -p personal_knowledge_graph < database/procedures/01_core_procedures.sql
mysql -u root -p personal_knowledge_graph < database/triggers/01_maintenance_triggers.sql
mysql -u root -p personal_knowledge_graph < database/seeds/01_comprehensive_seed_data.sql
```

### 3. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

### 4. Frontend Setup
```bash
cd ..
npm install
npm run dev
```

### 5. Access the Application
- Frontend: http://localhost:3000

## API Documentation

### Core Endpoints

#### Concepts
- `GET /api/concepts` - List concepts with filtering
- `GET /api/concepts/:id` - Get concept details
- `POST /api/concepts` - Create concept
- `PUT /api/concepts/:id` - Update concept
- `DELETE /api/concepts/:id` - Delete concept

#### Search
- `POST /api/search/concepts` - Full-text concept search
- `POST /api/search/notes` - Advanced note search
- `GET /api/search/suggestions` - Popular search terms
- `GET /api/search/autocomplete` - Autocomplete suggestions

#### Graph Operations
- `GET /api/graph/visualization/:id` - Graph visualization data
- `POST /api/graph/paths/shortest` - Shortest path between concepts
- `POST /api/graph/connections/n-hop` - N-hop connections
- `GET /api/graph/components` - Connected components
- `GET /api/graph/export` - Export graph data


## Advanced Features

### Graph Algorithms
- **N-hop Traversal**: Find all concepts within N connections
- **Shortest Path**: Dijkstra's algorithm implementation
- **Connected Components**: Graph connectivity analysis
- **Centrality Measures**: Degree, betweenness, and closeness centrality
- **Similarity Detection**: Jaccard similarity and content analysis

### Performance Optimization
- **Materialized Views**: Pre-computed aggregations
- **Composite Indexes**: Optimized for common query patterns
- **Connection Pooling**: Efficient database connection management
- **Query Caching**: Intelligent result caching
- **Full-Text Search**: Optimized natural language search

### Analytics & Monitoring
- **Query Analytics**: Search pattern analysis
- **Performance Metrics**: Query execution tracking
- **Graph Statistics**: Real-time graph metrics
- **Usage Patterns**: User behavior analysis

## Performance Benchmarks

### Database Performance
- **Concept Search**: < 100ms for 1000+ concepts
- **Note Search**: < 200ms with full-text relevance
- **Graph Traversal**: < 500ms for 3-hop connections
- **Similarity Calculation**: < 1s for concept similarity

### System Metrics
- **Response Time**: < 200ms average API response
- **Concurrent Users**: 100+ simultaneous users
- **Data Volume**: Optimized for 10,000+ concepts, 50,000+ notes
- **Search Performance**: Sub-second full-text search

## Testing

### Database Tests
```bash
# Run database unit tests
mysql -u root -p personal_knowledge_graph < database/procedures/02_unit_tests.sql

# Run sanity tests
mysql -u root -p personal_knowledge_graph < database/seeds/02_sanity_tests.sql

# Run performance tests
mysql -u root -p personal_knowledge_graph < database/scripts/02_performance_tests.sql
```

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
npm test
```

## Scalability Considerations

### Database Scaling
- Connection pooling for high concurrency
- Read replicas for read-heavy workloads
- Partitioning for large datasets
- Query optimization and indexing

### Application Scaling
- Stateless API design
- Horizontal scaling support
- Load balancing ready
- Caching strategies

### Performance Monitoring
- Real-time performance metrics
- Query execution tracking
- Resource usage monitoring
- Automated alerting

## License (polite)

This project is provided as educational material for database design and full-stack development courses.

---
