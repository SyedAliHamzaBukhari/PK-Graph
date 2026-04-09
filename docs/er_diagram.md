# Personal Knowledge Graph - Entity Relationship Diagram

## Core Entities

### 1. Concepts (Primary Nodes)
```
concepts
├── id (PK)
├── name (UNIQUE)
├── description
├── type (ENUM)
├── created_at
└── updated_at
```
**Purpose**: Represents the core nodes in the knowledge graph - people, places, ideas, events, etc.

### 2. Notes (Content)
```
notes
├── id (PK)
├── concept_id (FK → concepts.id)
├── title
├── body
├── source_url
├── source_type (ENUM)
├── importance_score (0.00-1.00)
├── is_private
├── created_at
└── updated_at
```
**Purpose**: Detailed information and content attached to concepts.

### 3. Links (Relationships)
```
links
├── id (PK)
├── source_concept_id (FK → concepts.id)
├── target_concept_id (FK → concepts.id)
├── relationship_type (ENUM)
├── strength (0.00-1.00)
├── description
├── bidirectional
├── created_at
└── updated_at
```
**Purpose**: Represents directed relationships between concepts (edges in the graph).

### 4. Tags (Categorization)
```
tags
├── id (PK)
├── name (UNIQUE)
├── color
├── description
├── usage_count
└── created_at
```
**Purpose**: Categorization labels for organizing and filtering content.

### 5. Sources (References)
```
sources
├── id (PK)
├── title
├── author
├── publication_year
├── url
├── source_type (ENUM)
├── doi
├── isbn
├── metadata (JSON)
├── credibility_score (0.00-1.00)
├── created_at
└── updated_at
```
**Purpose**: External references and citations for notes.

## Relationship Tables (Many-to-Many)

### 6. note_tags
```
note_tags
├── note_id (FK → notes.id)
├── tag_id (FK → tags.id)
└── created_at
```
**Purpose**: Links notes to multiple tags (many-to-many).

### 7. note_sources
```
note_sources
├── note_id (FK → notes.id)
├── source_id (FK → sources.id)
├── citation_text
├── page_reference
└── created_at
```
**Purpose**: Links notes to multiple sources (many-to-many).

## Analytics & Performance Tables

### 8. query_history
```
query_history
├── id (PK)
├── search_query
├── query_type (ENUM)
├── results_count
├── execution_time_ms
├── user_session
├── ip_address
├── user_agent
└── created_at
```
**Purpose**: Tracks all search queries for analytics and optimization.

### 9. concept_summaries (Materialized View)
```
concept_summaries
├── concept_id (PK, FK → concepts.id)
├── note_count
├── link_count
├── avg_importance
├── last_activity
├── summary_text
├── key_tags (JSON)
├── related_concepts (JSON)
└── last_updated
```
**Purpose**: Pre-computed summaries for performance optimization.

### 10. graph_metrics
```
graph_metrics
├── id (PK)
├── metric_date (UNIQUE)
├── total_concepts
├── total_notes
├── total_links
├── total_tags
├── avg_connections_per_concept
├── most_connected_concept
├── queries_executed
└── created_at
```
**Purpose**: Daily analytics and system metrics.

## Key Relationships

### One-to-Many
- **concepts → notes**: One concept can have many notes
- **concepts → links** (as source): One concept can be source of many links
- **concepts → links** (as target): One concept can be target of many links
- **tags → note_tags**: One tag can be applied to many notes
- **sources → note_sources**: One source can reference many notes

### Many-to-Many
- **notes ↔ tags**: Through note_tags junction table
- **notes ↔ sources**: Through note_sources junction table
- **concepts ↔ concepts**: Through links table (self-referencing relationship)

### Constraints & Business Rules
1. **Unique Constraints**:
   - concepts.name must be unique
   - graph_metrics.metric_date must be unique
   - note_tags (note_id, tag_id) must be unique
   - note_sources (note_id, source_id) must be unique
   - links (source_concept_id, target_concept_id, relationship_type) must be unique

2. **Referential Integrity**:
   - All foreign keys have CASCADE delete for data consistency
   - concepts cannot link to themselves (CHECK constraint)

3. **Data Validation**:
   - importance_score and credibility_score: 0.00 to 1.00
   - strength: 0.00 to 1.00
   - publication_year: reasonable year range

## Indexing Strategy

### Primary Indexes
- All tables have auto-increment primary keys

### Foreign Key Indexes
- All foreign key columns are indexed for join performance

### Search Indexes
- **FULLTEXT indexes** on:
  - concepts (name, description)
  - notes (title, body)
  - sources (title, author)
  - query_history (search_query)

### Performance Indexes
- created_at, updated_at for temporal queries
- importance_score, strength, credibility_score for range queries
- type fields for filtering

## Normalization Form
The schema is in **Third Normal Form (3NF)**:
- 1NF: All attributes are atomic
- 2NF: No partial dependencies on composite keys
- 3NF: No transitive dependencies
