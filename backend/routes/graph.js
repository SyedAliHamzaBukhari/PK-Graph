const express = require('express');
const Joi = require('joi');
const GraphUtils = require('../utils/graphUtils');
const db = require('../config/database');

const router = express.Router();

// Validation schemas
const findPathSchema = Joi.object({
  sourceId: Joi.number().integer().required(),
  targetId: Joi.number().integer().required(),
  maxHops: Joi.number().integer().min(1).max(10).default(5)
});

const nHopConnectionsSchema = Joi.object({
  conceptId: Joi.number().integer().required(),
  maxHops: Joi.number().integer().min(1).max(5).default(3),
  relationshipType: Joi.string().valid(
    'related_to', 'part_of', 'similar_to', 'causes', 
    'enables', 'requires', 'contradicts', 'example_of', 'other'
  ).optional(),
  minStrength: Joi.number().min(0).max(1).default(0.0)
});

// GET /api/graph/visualization/:conceptId - Get graph visualization data
router.get('/visualization/:conceptId', async (req, res) => {
  try {
    const { conceptId } = req.params;
    const { depth = 2 } = req.query;

    const graphData = await GraphUtils.getVisualizationData(conceptId, parseInt(depth));

    res.json({
      success: true,
      data: graphData,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error generating graph visualization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate graph visualization',
      requestId: req.id
    });
  }
});

// POST /api/graph/paths/shortest - Find shortest path between concepts
router.post('/paths/shortest', async (req, res) => {
  try {
    const { error, value } = findPathSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        requestId: req.id
      });
    }

    const { sourceId, targetId, maxHops } = value;

    const path = await GraphUtils.findShortestPath(sourceId, targetId);

    if (!path) {
      return res.json({
        success: true,
        data: null,
        message: 'No path found between the specified concepts',
        requestId: req.id
      });
    }

    // Get detailed path information
    const [pathDetails] = await db.execute(`
      SELECT 
        c.id, c.name, c.type
      FROM concepts c
      WHERE c.id IN (${path.path.map((_, index) => '?').join(',')})
      ORDER BY FIELD(c.id, ${path.path.map(() => '?').join(',')})
    `, [...path.path, ...path.path]);

    res.json({
      success: true,
      data: {
        path: pathDetails,
        length: path.length,
        strength: path.strength,
        pathNames: path.path
      },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error finding shortest path:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find shortest path',
      requestId: req.id
    });
  }
});

// POST /api/graph/connections/n-hop - Find N-hop connections
router.post('/connections/n-hop', async (req, res) => {
  try {
    const { error, value } = nHopConnectionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        requestId: req.id
      });
    }

    const { conceptId, maxHops, relationshipType, minStrength } = value;

    // Use stored procedure for N-hop connections
    const [connections] = await db.callProcedure('find_n_hop_connections', [
      conceptId, maxHops, relationshipType || null, minStrength
    ]);

    // Log graph traversal query
    await db.execute(`
      INSERT INTO query_history (search_query, query_type, results_count, user_session, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `, [
      `N-hop connections from concept ${conceptId}`,
      'graph_traversal',
      connections.length,
      req.session?.id || null,
      req.ip
    ]);

    res.json({
      success: true,
      data: connections,
      query: {
        conceptId,
        maxHops,
        relationshipType,
        minStrength
      },
      total: connections.length,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error finding N-hop connections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find N-hop connections',
      requestId: req.id
    });
  }
});

// GET /api/graph/components - Get connected components
router.get('/components', async (req, res) => {
  try {
    const components = await GraphUtils.getConnectedComponents();

    res.json({
      success: true,
      data: components,
      totalComponents: components.length,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error getting connected components:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get connected components',
      requestId: req.id
    });
  }
});

// GET /api/graph/centrality/:conceptId - Get centrality measures for a concept
router.get('/centrality/:conceptId', async (req, res) => {
  try {
    const { conceptId } = req.params;

    // Get centrality measures using stored procedure
    const [centralityData] = await db.callProcedure('analyze_graph_centrality');

    // Find the specific concept's centrality
    const conceptCentrality = centralityData.find(c => c.concept_id == conceptId);

    if (!conceptCentrality) {
      return res.status(404).json({
        success: false,
        error: 'Concept not found or no centrality data available',
        requestId: req.id
      });
    }

    // Get ranking information
    const sortedByDegree = [...centralityData].sort((a, b) => b.degree_centrality - a.degree_centrality);
    const sortedByBetweenness = [...centralityData].sort((a, b) => b.betweenness_centrality - a.betweenness_centrality);
    const sortedByCloseness = [...centralityData].sort((a, b) => b.closeness_centrality - a.closeness_centrality);

    const degreeRank = sortedByDegree.findIndex(c => c.concept_id == conceptId) + 1;
    const betweennessRank = sortedByBetweenness.findIndex(c => c.concept_id == conceptId) + 1;
    const closenessRank = sortedByCloseness.findIndex(c => c.concept_id == conceptId) + 1;

    res.json({
      success: true,
      data: {
        ...conceptCentrality,
        rankings: {
          degree: { rank: degreeRank, total: centralityData.length },
          betweenness: { rank: betweennessRank, total: centralityData.length },
          closeness: { rank: closenessRank, total: centralityData.length }
        }
      },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error getting centrality measures:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get centrality measures',
      requestId: req.id
    });
  }
});

// GET /api/graph/influential - Get influential concepts (hubs and authorities)
router.get('/influential', async (req, res) => {
  try {
    const { minConnections = 3, limit = 20 } = req.query;

    // Use stored procedure to find influential concepts
    const [influential] = await db.callProcedure('find_influential_concepts', [
      parseInt(minConnections),
      parseInt(limit)
    ]);

    // Separate hubs and authorities
    const hubs = influential.filter(item => item.influence_type === 'HUB');
    const authorities = influential.filter(item => item.influence_type === 'AUTHORITY');

    res.json({
      success: true,
      data: {
        hubs,
        authorities,
        total: influential.length
      },
      query: { minConnections, limit },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error getting influential concepts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get influential concepts',
      requestId: req.id
    });
  }
});

// GET /api/graph/export - Export graph data
router.get('/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const exportData = await GraphUtils.exportGraph(format);

    // Set appropriate headers
    const filename = `knowledge-graph-${new Date().toISOString().split('T')[0]}`;
    
    switch (format.toLowerCase()) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        break;
      case 'gexf':
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.gexf"`);
        break;
      case 'graphml':
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.graphml"`);
        break;
    }

    res.json({
      success: true,
      data: exportData,
      format,
      filename,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error exporting graph:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export graph',
      requestId: req.id
    });
  }
});

// GET /api/graph/statistics - Get comprehensive graph statistics
router.get('/statistics', async (req, res) => {
  try {
    const statistics = await GraphUtils.analyzeGraph();

    res.json({
      success: true,
      data: statistics,
      requestId: req.id
    });
  } catch (error) {
    console.error('Error getting graph statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get graph statistics',
      requestId: req.id
    });
  }
});

// POST /api/graph/metrics - Calculate custom graph metrics
router.post('/metrics', async (req, res) => {
  try {
    const { nodes, edges, metrics = ['degree', 'betweenness', 'closeness'] } = req.body;

    if (!nodes || !edges) {
      return res.status(400).json({
        success: false,
        error: 'Nodes and edges are required',
        requestId: req.id
      });
    }

    const graphMetrics = GraphUtils.calculateGraphMetrics(nodes, edges);

    // Filter requested metrics
    const filteredMetrics = {};
    metrics.forEach(metric => {
      if (graphMetrics[metric]) {
        filteredMetrics[metric] = graphMetrics[metric];
      }
    });

    res.json({
      success: true,
      data: {
        ...filteredMetrics,
        nodeCount: graphMetrics.nodeCount,
        edgeCount: graphMetrics.edgeCount,
        density: graphMetrics.density
      },
      requestId: req.id
    });
  } catch (error) {
    console.error('Error calculating graph metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate graph metrics',
      requestId: req.id
    });
  }
});

module.exports = router;