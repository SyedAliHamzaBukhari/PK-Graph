const express = require('express');
const Joi = require('joi');
const db = require('../config/database');

const router = express.Router();

// Validation schemas
const createConceptSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).optional(),
  type: Joi.string().valid('person', 'place', 'concept', 'event', 'document', 'idea', 'other').default('concept')
});

const updateConceptSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).optional(),
  type: Joi.string().valid('person', 'place', 'concept', 'event', 'document', 'idea', 'other').required()
});

// GET /api/concepts - Get all concepts with optional filtering
router.get('/', async (req, res) => {
  try {
    const { 
      type, 
      limit = 50, 
      offset = 0, 
      search,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    let whereClause = '';
    let params = [];

    // Build WHERE clause
    if (type) {
      whereClause += ' WHERE type = ?';
      params.push(type);
    }

    if (search) {
      whereClause += whereClause ? ' AND' : ' WHERE';
      whereClause += ' (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Validate sort parameters
    const validSortFields = ['name', 'type', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    const sortDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Get concepts with statistics
    const query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.type,
        c.created_at,
        c.updated_at,
        COALESCE(cs.note_count, 0) as note_count,
        COALESCE(cs.link_count, 0) as link_count,
        COALESCE(cs.avg_importance, 0.00) as avg_importance,
        COALESCE(cs.last_activity, c.created_at) as last_activity
      FROM concepts c
      LEFT JOIN concept_summaries cs ON c.id = cs.concept_id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));
    const [concepts] = await db.execute(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM concepts c
      ${whereClause.replace(/LIMIT.*$/i, '')}
    `;
    const [countResult] = await db.execute(countQuery, params.slice(0, -2));

    res.json({
      success: true,
      data: concepts,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < countResult[0].total
      },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error fetching concepts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch concepts',
      requestId: req.id
    });
  }
});

// GET /api/concepts/:id - Get specific concept with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get concept details with statistics
    const [concept] = await db.execute(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.type,
        c.created_at,
        c.updated_at,
        COALESCE(cs.note_count, 0) as note_count,
        COALESCE(cs.link_count, 0) as link_count,
        COALESCE(cs.avg_importance, 0.00) as avg_importance,
        COALESCE(cs.last_activity, c.created_at) as last_activity,
        cs.summary_text,
        cs.key_tags,
        cs.related_concepts
      FROM concepts c
      LEFT JOIN concept_summaries cs ON c.id = cs.concept_id
      WHERE c.id = ?
    `, [id]);

    if (concept.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Concept not found',
        requestId: req.id
      });
    }

    // Get related notes
    const [notes] = await db.execute(`
      SELECT 
        n.id,
        n.title,
        n.importance_score,
        n.source_type,
        n.created_at,
        GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ', ') as tags
      FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.concept_id = ?
      GROUP BY n.id
      ORDER BY n.importance_score DESC, n.created_at DESC
    `, [id]);

    // Get connected concepts
    const [connections] = await db.execute(`
      SELECT 
        CASE 
          WHEN l.source_concept_id = ? THEN l.target_concept_id
          ELSE l.source_concept_id
        END as connected_concept_id,
        CASE 
          WHEN l.source_concept_id = ? THEN c2.name
          ELSE c1.name
        END as connected_concept_name,
        l.relationship_type,
        l.strength,
        l.bidirectional
      FROM links l
      JOIN concepts c1 ON l.source_concept_id = c1.id
      JOIN concepts c2 ON l.target_concept_id = c2.id
      WHERE (l.source_concept_id = ? OR l.target_concept_id = ?)
      AND l.source_concept_id != l.target_concept_id
      ORDER BY l.strength DESC, connected_concept_name
    `, [id, id, id, id]);

    res.json({
      success: true,
      data: {
        ...concept[0],
        notes,
        connections
      },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error fetching concept:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch concept',
      requestId: req.id
    });
  }
});

// POST /api/concepts - Create new concept
router.post('/', async (req, res) => {
  try {
    const { error, value } = createConceptSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        requestId: req.id
      });
    }

    const { name, description, type } = value;

    // Use stored procedure to create concept
    const [result] = await db.callProcedure('create_concept', [name, description, type]);

    if (result[0] && result[0].concept_id) {
      // Fetch the created concept
      const [newConcept] = await db.execute(`
        SELECT id, name, description, type, created_at, updated_at
        FROM concepts
        WHERE id = ?
      `, [result[0].concept_id]);

      res.status(201).json({
        success: true,
        data: newConcept[0],
        message: 'Concept created successfully',
        requestId: req.id
      });
    } else {
      res.status(400).json({
        success: false,
        error: result[0]?.status || 'Failed to create concept',
        requestId: req.id
      });
    }
  } catch (error) {
    console.error('Error creating concept:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create concept',
      requestId: req.id
    });
  }
});

// PUT /api/concepts/:id - Update concept
router.put('/:id', async (req, res) => {
  try {
    const { error, value } = updateConceptSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        requestId: req.id
      });
    }

    const { id } = req.params;
    const { name, description, type } = value;

    // Use stored procedure to update concept
    const [result] = await db.callProcedure('update_concept', [id, name, description, type]);

    if (result[0] && result[0].status === 'Concept updated successfully') {
      // Fetch the updated concept
      const [updatedConcept] = await db.execute(`
        SELECT id, name, description, type, created_at, updated_at
        FROM concepts
        WHERE id = ?
      `, [id]);

      res.json({
        success: true,
        data: updatedConcept[0],
        message: 'Concept updated successfully',
        requestId: req.id
      });
    } else {
      res.status(400).json({
        success: false,
        error: result[0]?.status || 'Failed to update concept',
        requestId: req.id
      });
    }
  } catch (error) {
    console.error('Error updating concept:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update concept',
      requestId: req.id
    });
  }
});

// DELETE /api/concepts/:id - Delete concept
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Use stored procedure to delete concept
    const [result] = await db.callProcedure('delete_concept', [id]);

    if (result[0] && result[0].status === 'Concept deleted successfully') {
      res.json({
        success: true,
        message: 'Concept deleted successfully',
        requestId: req.id
      });
    } else {
      res.status(400).json({
        success: false,
        error: result[0]?.status || 'Failed to delete concept',
        requestId: req.id
      });
    }
  } catch (error) {
    console.error('Error deleting concept:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete concept',
      requestId: req.id
    });
  }
});

// GET /api/concepts/:id/statistics - Get detailed statistics for a concept
router.get('/:id/statistics', async (req, res) => {
  try {
    const { id } = req.params;

    // Use stored procedure to get concept statistics
    const [stats] = await db.callProcedure('get_concept_statistics', [id]);

    if (stats.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Concept not found',
        requestId: req.id
      });
    }

    res.json({
      success: true,
      data: stats[0],
      requestId: req.id
    });
  } catch (error) {
    console.error('Error fetching concept statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch concept statistics',
      requestId: req.id
    });
  }
});

module.exports = router;