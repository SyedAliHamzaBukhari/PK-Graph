const express = require('express');
const Joi = require('joi');
const db = require('../config/database');

const router = express.Router();

// Validation schemas
const searchConceptsSchema = Joi.object({
  query: Joi.string().min(2).max(500).optional(),
  type: Joi.string().valid('person', 'place', 'concept', 'event', 'document', 'idea', 'other').optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

const searchNotesSchema = Joi.object({
  query: Joi.string().min(2).max(500).optional(),
  conceptId: Joi.number().integer().optional(),
  importanceMin: Joi.number().min(0).max(1).optional(),
  importanceMax: Joi.number().min(0).max(1).optional(),
  tagIds: Joi.string().optional(), // Comma-separated tag IDs
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

// POST /api/search/concepts - Search concepts with full-text search
router.post('/concepts', async (req, res) => {
  try {
    const { error, value } = searchConceptsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        requestId: req.id
      });
    }

    const { query, type, limit, offset } = value;

    // Use stored procedure for concept search
    const [results] = await db.callProcedure('search_concepts', [
      query || null,
      type || null,
      limit,
      offset
    ]);

    // Log search query for analytics
    await db.execute(`
      INSERT INTO query_history (search_query, query_type, results_count, user_session, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `, [
      query || 'all concepts',
      'concept_search',
      results.length,
      req.session?.id || null,
      req.ip
    ]);

    res.json({
      success: true,
      data: results,
      query: {
        text: query,
        type,
        limit,
        offset
      },
      total: results.length,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error searching concepts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search concepts',
      requestId: req.id
    });
  }
});

// POST /api/search/notes - Search notes with advanced filtering
router.post('/notes', async (req, res) => {
  try {
    const { error, value } = searchNotesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        requestId: req.id
      });
    }

    const { query, conceptId, importanceMin, importanceMax, tagIds, limit, offset } = value;

    // Use stored procedure for note search
    const [results] = await db.callProcedure('search_notes', [
      query || null,
      conceptId || null,
      importanceMin || null,
      importanceMax || null,
      tagIds || null,
      limit,
      offset
    ]);

    // Log search query for analytics
    await db.execute(`
      INSERT INTO query_history (search_query, query_type, results_count, user_session, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `, [
      query || 'all notes',
      'note_search',
      results.length,
      req.session?.id || null,
      req.ip
    ]);

    res.json({
      success: true,
      data: results,
      query: {
        text: query,
        conceptId,
        importanceMin,
        importanceMax,
        tagIds,
        limit,
        offset
      },
      total: results.length,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search notes',
      requestId: req.id
    });
  }
});

// GET /api/search/suggestions - Get search suggestions based on popular searches
router.get('/suggestions', async (req, res) => {
  try {
    const { limit = 10, type } = req.query;

    // Get popular search terms
    const [suggestions] = await db.callProcedure('get_popular_search_terms', [30]); // Last 30 days

    // Filter by type if specified
    let filteredSuggestions = suggestions;
    if (type) {
      filteredSuggestions = suggestions.filter(s => 
        s.search_query.toLowerCase().includes(type.toLowerCase())
      );
    }

    // Get recent searches for this session (if session exists)
    let recentSearches = [];
    if (req.session?.id) {
      const [recent] = await db.execute(`
        SELECT DISTINCT search_query, created_at
        FROM query_history
        WHERE user_session = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY created_at DESC
        LIMIT 5
      `, [req.session.id]);
      recentSearches = recent;
    }

    res.json({
      success: true,
      data: {
        popular: filteredSuggestions.slice(0, parseInt(limit)),
        recent: recentSearches
      },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions',
      requestId: req.id
    });
  }
});

// GET /api/search/autocomplete - Autocomplete for concept names
router.get('/autocomplete', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: [],
        requestId: req.id
      });
    }

    // Get concept name suggestions
    const [suggestions] = await db.execute(`
      SELECT 
        id,
        name as label,
        type,
        CONCAT(name, ' (', type, ')') as description
      FROM concepts
      WHERE name LIKE ?
      ORDER BY 
        CASE WHEN name LIKE ? THEN 1 ELSE 2 END,
        CHAR_LENGTH(name),
        name
      LIMIT ?
    `, [
      `%${query}%`,
      `${query}%`,
      parseInt(limit)
    ]);

    res.json({
      success: true,
      data: suggestions,
      query,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error getting autocomplete suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get autocomplete suggestions',
      requestId: req.id
    });
  }
});

// GET /api/search/tags - Search tags
router.get('/tags', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;

    let whereClause = '';
    let params = [];

    if (query) {
      whereClause = 'WHERE name LIKE ?';
      params.push(`%${query}%`);
    }

    const [tags] = await db.execute(`
      SELECT 
        id,
        name,
        color,
        description,
        usage_count
      FROM tags
      ${whereClause}
      ORDER BY usage_count DESC, name
      LIMIT ?
    `, [...params, parseInt(limit)]);

    res.json({
      success: true,
      data: tags,
      query,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error searching tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tags',
      requestId: req.id
    });
  }
});

// GET /api/search/sources - Search sources
router.get('/sources', async (req, res) => {
  try {
    const { q: query, type, limit = 20 } = req.query;

    let whereClause = '';
    let params = [];

    if (query) {
      whereClause = 'WHERE (title LIKE ? OR author LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }

    if (type) {
      whereClause += whereClause ? ' AND source_type = ?' : 'WHERE source_type = ?';
      params.push(type);
    }

    const [sources] = await db.execute(`
      SELECT 
        id,
        title,
        author,
        publication_year,
        source_type,
        credibility_score,
        url
      FROM sources
      ${whereClause}
      ORDER BY credibility_score DESC, publication_year DESC, title
      LIMIT ?
    `, [...params, parseInt(limit)]);

    res.json({
      success: true,
      data: sources,
      query: { text: query, type },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error searching sources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search sources',
      requestId: req.id
    });
  }
});

// POST /api/search/advanced - Advanced search with multiple criteria
router.post('/advanced', async (req, res) => {
  try {
    const {
      concepts = [],
      notes = [],
      tags = [],
      sources = [],
      operators = {} // AND/OR logic between different search types
    } = req.body;

    const startTime = Date.now();
    let results = {
      concepts: [],
      notes: [],
      tags: [],
      sources: []
    };

    // Search concepts
    if (concepts.length > 0) {
      const conceptQuery = concepts.map(c => `name LIKE ?`).join(' OR ');
      const conceptParams = concepts.map(c => `%${c}%`);
      
      const [conceptResults] = await db.execute(`
        SELECT 
          id, name, description, type, created_at,
          MATCH(name, description) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance_score
        FROM concepts
        WHERE ${conceptQuery}
        ORDER BY relevance_score DESC, name
        LIMIT 50
      `, [concepts.join(' '), ...conceptParams]);
      
      results.concepts = conceptResults;
    }

    // Search notes
    if (notes.length > 0) {
      const noteQuery = notes.map(n => `(title LIKE ? OR body LIKE ?)`).join(' OR ');
      const noteParams = notes.flatMap(n => [`%${n}%`, `%${n}%`]);
      
      const [noteResults] = await db.execute(`
        SELECT 
          n.id, n.title, n.importance_score, n.source_type, n.created_at,
          c.name as concept_name,
          MATCH(n.title, n.body) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance_score
        FROM notes n
        JOIN concepts c ON n.concept_id = c.id
        WHERE ${noteQuery}
        ORDER BY relevance_score DESC, n.importance_score DESC
        LIMIT 50
      `, [notes.join(' '), ...noteParams]);
      
      results.notes = noteResults;
    }

    // Search tags
    if (tags.length > 0) {
      const tagQuery = tags.map(t => `name LIKE ?`).join(' OR ');
      const tagParams = tags.map(t => `%${t}%`);
      
      const [tagResults] = await db.execute(`
        SELECT id, name, color, description, usage_count
        FROM tags
        WHERE ${tagQuery}
        ORDER BY usage_count DESC, name
        LIMIT 20
      `, tagParams);
      
      results.tags = tagResults;
    }

    // Search sources
    if (sources.length > 0) {
      const sourceQuery = sources.map(s => `(title LIKE ? OR author LIKE ?)`).join(' OR ');
      const sourceParams = sources.flatMap(s => [`%${s}%`, `%${s}%`]);
      
      const [sourceResults] = await db.execute(`
        SELECT id, title, author, publication_year, source_type, credibility_score
        FROM sources
        WHERE ${sourceQuery}
        ORDER BY credibility_score DESC, publication_year DESC
        LIMIT 20
      `, sourceParams);
      
      results.sources = sourceResults;
    }

    const executionTime = Date.now() - startTime;

    // Log advanced search
    await db.execute(`
      INSERT INTO query_history (search_query, query_type, results_count, execution_time_ms, user_session, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      JSON.stringify({ concepts, notes, tags, sources }),
      'advanced_search',
      results.concepts.length + results.notes.length + results.tags.length + results.sources.length,
      executionTime,
      req.session?.id || null,
      req.ip
    ]);

    res.json({
      success: true,
      data: results,
      executionTime,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform advanced search',
      requestId: req.id
    });
  }
});

module.exports = router;