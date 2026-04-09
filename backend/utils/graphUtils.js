const cytoscape = require('cytoscape');
const graphlib = require('graphlib');
const db = require('../config/database');

class GraphUtils {
  /**
   * Generate visualization data for Cytoscape.js
   * @param {string} conceptId - Starting concept ID
   * @param {number} depth - Depth of graph traversal
   * @returns {Object} Graph data in Cytoscape format
   */
  static async getVisualizationData(conceptId, depth = 2) {
    try {
      // Get N-hop connections using stored procedure
      const [connections] = await db.callProcedure('find_n_hop_connections', [conceptId, depth, null, 0.0]);
      
      if (!connections || connections.length === 0) {
        return {
          nodes: [],
          edges: [],
          layout: 'preset'
        };
      }

      // Build nodes and edges for Cytoscape
      const nodes = new Map();
      const edges = [];
      
      // Add root concept
      const [rootConcept] = await db.execute(
        'SELECT id, name, type FROM concepts WHERE id = ?',
        [conceptId]
      );
      
      if (rootConcept[0]) {
        nodes.set(rootConcept[0].id, {
          data: {
            id: rootConcept[0].id.toString(),
            label: rootConcept[0].name,
            type: rootConcept[0].type,
            root: true
          },
          classes: 'root'
        });
      }

      // Process connections
      connections.forEach(connection => {
        const sourceId = connection.from_concept_id.toString();
        const targetId = connection.to_concept_id.toString();
        
        // Add source node if not exists
        if (!nodes.has(sourceId)) {
          nodes.set(sourceId, {
            data: {
              id: sourceId,
              label: connection.from_concept_name,
              type: 'concept'
            }
          });
        }
        
        // Add target node if not exists
        if (!nodes.has(targetId)) {
          nodes.set(targetId, {
            data: {
              id: targetId,
              label: connection.to_concept_name,
              type: 'concept'
            }
          });
        }
        
        // Add edge
        edges.push({
          data: {
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            label: connection.relationship_type,
            strength: connection.strength,
            hopCount: connection.hop_number
          },
          classes: connection.relationship_type
        });
      });

      return {
        nodes: Array.from(nodes.values()),
        edges: edges,
        layout: 'cose',
        style: this.getCytoscapeStyle()
      };
    } catch (error) {
      console.error('Error generating visualization data:', error);
      throw error;
    }
  }

  /**
   * Get Cytoscape.js style configuration
   * @returns {Array} Style configuration
   */
  static getCytoscapeStyle() {
    return [
      {
        selector: 'node',
        style: {
          'background-color': '#2196F3',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#FFFFFF',
          'font-size': '12px',
          'width': '60px',
          'height': '60px',
          'border-width': '2px',
          'border-color': '#1976D2'
        }
      },
      {
        selector: 'node.root',
        style: {
          'background-color': '#FF5722',
          'border-color': '#D84315',
          'width': '80px',
          'height': '80px',
          'font-size': '14px',
          'font-weight': 'bold'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 'mapData(strength, 0, 1, 1, 5)',
          'line-color': '#666666',
          'target-arrow-color': '#666666',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'color': '#333333',
          'text-rotation': 'autorotate',
          'text-margin-y': '-10px'
        }
      },
      {
        selector: 'edge.related_to',
        style: {
          'line-color': '#4CAF50',
          'target-arrow-color': '#4CAF50'
        }
      },
      {
        selector: 'edge.part_of',
        style: {
          'line-color': '#2196F3',
          'target-arrow-color': '#2196F3',
          'line-style': 'dashed'
        }
      },
      {
        selector: 'edge.causes',
        style: {
          'line-color': '#F44336',
          'target-arrow-color': '#F44336'
        }
      },
      {
        selector: 'edge.enables',
        style: {
          'line-color': '#FF9800',
          'target-arrow-color': '#FF9800'
        }
      }
    ];
  }

  /**
   * Calculate graph metrics using graphlib
   * @param {Array} nodes - Array of node objects
   * @param {Array} edges - Array of edge objects
   * @returns {Object} Graph metrics
   */
  static calculateGraphMetrics(nodes, edges) {
    const g = new graphlib.Graph({
      directed: true,
      multigraph: false
    });

    // Add nodes
    nodes.forEach(node => {
      g.setNode(node.data.id, node.data);
    });

    // Add edges with weights
    edges.forEach(edge => {
      g.setEdge(edge.data.source, edge.data.target, {
        weight: edge.data.strength || 1,
        type: edge.data.label
      });
    });

    // Calculate metrics
    const metrics = {
      nodeCount: g.nodeCount(),
      edgeCount: g.edgeCount(),
      density: graphlib.alg.density(g),
      isConnected: graphlib.alg.isAcyclic(g) ? false : graphlib.alg.isConnected(g),
      components: graphlib.alg.components(g),
      centrality: {
        betweenness: graphlib.alg.betweenness(g, true),
        closeness: graphlib.alg.closeness(g, true),
        degree: {}
      }
    };

    // Calculate degree centrality
    nodes.forEach(node => {
      metrics.centrality.degree[node.data.id] = g.nodeEdges(node.data.id).length;
    });

    return metrics;
  }

  /**
   * Find shortest path between two concepts
   * @param {string} sourceId - Source concept ID
   * @param {string} targetId - Target concept ID
   * @returns {Array} Array of concept IDs representing the path
   */
  static async findShortestPath(sourceId, targetId) {
    try {
      const [pathResult] = await db.callProcedure('find_shortest_path', [sourceId, targetId, 5]);
      
      if (!pathResult || pathResult.length === 0) {
        return null;
      }

      // Extract path from the result
      const path = pathResult[0].full_path.split(' -> ').map(name => name.trim());
      
      return {
        path: path,
        length: pathResult[0].path_length,
        strength: pathResult[0].cumulative_strength
      };
    } catch (error) {
      console.error('Error finding shortest path:', error);
      throw error;
    }
  }

  /**
   * Get connected components of the graph
   * @returns {Array} Array of connected components
   */
  static async getConnectedComponents() {
    try {
      const [components] = await db.callProcedure('find_connected_components');
      
      if (!components || components.length === 0) {
        return [];
      }

      // Group by component_id
      const componentMap = new Map();
      components.forEach(item => {
        if (!componentMap.has(item.component_id)) {
          componentMap.set(item.component_id, []);
        }
        componentMap.get(item.component_id).push({
          id: item.concept_id,
          name: item.concept_name
        });
      });

      return Array.from(componentMap.values());
    } catch (error) {
      console.error('Error getting connected components:', error);
      throw error;
    }
  }

  /**
   * Analyze graph structure and return insights
   * @returns {Object} Graph analysis results
   */
  static async analyzeGraph() {
    try {
      // Get graph overview
      const [overview] = await db.callProcedure('get_graph_overview');
      
      // Get top concepts by various metrics
      const [topByNotes] = await db.callProcedure('get_top_concepts', ['note_count', 10]);
      const [topByLinks] = await db.callProcedure('get_top_concepts', ['link_count', 10]);
      
      // Get influential concepts
      const [influential] = await db.callProcedure('find_influential_concepts', [3, 10]);

      return {
        overview: overview[0] || {},
        topConcepts: {
          byNotes: topByNotes || [],
          byLinks: topByLinks || []
        },
        influential: influential || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error analyzing graph:', error);
      throw error;
    }
  }

  /**
   * Export graph data in various formats
   * @param {string} format - Export format ('json', 'gexf', 'graphml')
   * @returns {Object} Exported data
   */
  static async exportGraph(format = 'json') {
    try {
      // Get all concepts and links
      const [concepts] = await db.execute('SELECT * FROM concepts');
      const [links] = await db.execute('SELECT * FROM links');

      switch (format.toLowerCase()) {
        case 'json':
          return {
            nodes: concepts,
            edges: links,
            metadata: {
              exportDate: new Date().toISOString(),
              nodeCount: concepts.length,
              edgeCount: links.length
            }
          };

        case 'gexf':
          return this.toGEXF(concepts, links);

        case 'graphml':
          return this.toGraphML(concepts, links);

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Error exporting graph:', error);
      throw error;
    }
  }

  /**
   * Convert graph data to GEXF format
   * @private
   */
  static toGEXF(nodes, edges) {
    // Simplified GEXF conversion
    const gexf = {
      'gexf': {
        '@xmlns': 'http://www.gexf.net/1.2draft',
        '@version': '1.2',
        'graph': {
          '@defaultedgetype': 'directed',
          'nodes': {
            'node': nodes.map(node => ({
              '@id': node.id,
              '@label': node.name,
              'attvalues': {
                'attvalue': [
                  { '@for': 'type', '@value': node.type },
                  { '@for': 'created', '@value': node.created_at }
                ]
              }
            }))
          },
          'edges': {
            'edge': edges.map(edge => ({
              '@id': edge.id,
              '@source': edge.source_concept_id,
              '@target': edge.target_concept_id,
              'attvalues': {
                'attvalue': [
                  { '@for': 'type', '@value': edge.relationship_type },
                  { '@for': 'strength', '@value': edge.strength }
                ]
              }
            }))
          }
        }
      }
    };

    return gexf;
  }

  /**
   * Convert graph data to GraphML format
   * @private
   */
  static toGraphML(nodes, edges) {
    // Simplified GraphML conversion
    return {
      'graphml': {
        '@xmlns': 'http://graphml.graphdrawing.org/xmlns',
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@xsi:schemaLocation': 'http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd',
        'key': [
          { '@id': 'type', '@for': 'node', '@attr.name': 'type', '@attr.type': 'string' },
          { '@id': 'relationship', '@for': 'edge', '@attr.name': 'relationship', '@attr.type': 'string' },
          { '@id': 'strength', '@for': 'edge', '@attr.name': 'strength', '@attr.type': 'double' }
        ],
        'graph': {
          '@id': 'G',
          '@edgedefault': 'directed',
          'node': nodes.map(node => ({
            '@id': node.id,
            'data': { '@key': 'type', '#text': node.type }
          })),
          'edge': edges.map(edge => ({
            '@id': edge.id,
            '@source': edge.source_concept_id,
            '@target': edge.target_concept_id,
            'data': [
              { '@key': 'relationship', '#text': edge.relationship_type },
              { '@key': 'strength', '#text': edge.strength }
            ]
          }))
        }
      }
    };
  }
}

module.exports = GraphUtils;