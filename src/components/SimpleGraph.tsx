'use client';

import { useEffect, useRef } from 'react';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  root?: boolean;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  strength: number;
}

interface SimpleGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
}

export default function SimpleGraph({ 
  nodes, 
  edges, 
  width = 800, 
  height = 600 
}: SimpleGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // Simple force-directed layout
    const nodeMap = new Map<string, GraphNode>();
    const nodePositions = new Map<string, { x: number; y: number }>();

    // Initialize positions in a circle
    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      const x = width / 2 + radius * Math.cos(angle);
      const y = height / 2 + radius * Math.sin(angle);
      
      nodePositions.set(node.id, { x, y });
      nodeMap.set(node.id, node);
    });

    // Simple physics simulation
    for (let iteration = 0; iteration < 50; iteration++) {
      // Apply repulsion between nodes
      nodePositions.forEach((pos1, id1) => {
        nodePositions.forEach((pos2, id2) => {
          if (id1 !== id2) {
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0 && distance < 100) {
              const force = 50 / distance;
              pos1.x -= (dx / distance) * force;
              pos1.y -= (dy / distance) * force;
              pos2.x += (dx / distance) * force;
              pos2.y += (dy / distance) * force;
            }
          }
        });
      });

      // Apply attraction along edges
      edges.forEach(edge => {
        const pos1 = nodePositions.get(edge.source);
        const pos2 = nodePositions.get(edge.target);
        
        if (pos1 && pos2) {
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const idealDistance = 100;
          const force = (distance - idealDistance) * 0.01;
          
          if (distance > 0) {
            pos1.x += (dx / distance) * force;
            pos1.y += (dy / distance) * force;
            pos2.x -= (dx / distance) * force;
            pos2.y -= (dy / distance) * force;
          }
        }
      });

      // Keep nodes within bounds
      nodePositions.forEach(pos => {
        pos.x = Math.max(30, Math.min(width - 30, pos.x));
        pos.y = Math.max(30, Math.min(height - 30, pos.y));
      });
    }

    // Render the graph
    const svg = svgRef.current;
    if (!svg) return;

    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Add edges
    edges.forEach(edge => {
      const pos1 = nodePositions.get(edge.source);
      const pos2 = nodePositions.get(edge.target);
      
      if (pos1 && pos2) {
        // Create edge line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pos1.x.toString());
        line.setAttribute('y1', pos1.y.toString());
        line.setAttribute('x2', pos2.x.toString());
        line.setAttribute('y2', pos2.y.toString());
        line.setAttribute('stroke', '#666666');
        line.setAttribute('stroke-width', Math.max(1, edge.strength * 3).toString());
        line.setAttribute('opacity', '0.6');
        svg.appendChild(line);

        // Add edge label
        const midX = (pos1.x + pos2.x) / 2;
        const midY = (pos1.y + pos2.y) / 2;
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX.toString());
        text.setAttribute('y', midY.toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '10');
        text.setAttribute('fill', '#333333');
        text.setAttribute('opacity', '0.7');
        text.textContent = edge.label;
        svg.appendChild(text);
      }
    });

    // Add nodes
    nodePositions.forEach((pos, id) => {
      const node = nodeMap.get(id);
      if (!node) return;

      // Create node group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

      // Create node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', node.root ? '25' : '20');
      circle.setAttribute('fill', getNodeColor(node.type));
      circle.setAttribute('stroke', '#333333');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('cursor', 'pointer');
      
      // Add hover effect
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute('stroke-width', '3');
        circle.setAttribute('stroke', '#000000');
      });
      
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('stroke', '#333333');
      });

      g.appendChild(circle);

      // Create node label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '5');
      text.setAttribute('font-size', node.root ? '12' : '11');
      text.setAttribute('font-weight', node.root ? 'bold' : 'normal');
      text.setAttribute('fill', '#FFFFFF');
      text.setAttribute('pointer-events', 'none');
      text.textContent = node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label;
      
      g.appendChild(text);

      svg.appendChild(g);
    });
  }, [nodes, edges, width, height]);

  const getNodeColor = (type: string): string => {
    const colors = {
      concept: '#2196F3',
      person: '#4CAF50',
      place: '#FF9800',
      event: '#9C27B0',
      document: '#F44336',
      idea: '#3F51B5',
      other: '#607D8B'
    };
    return colors[type as keyof typeof colors] || colors.other;
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full border rounded-lg bg-white">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      />
      
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-md border">
        <h4 className="font-medium text-sm mb-2">Legend</h4>
        <div className="space-y-1">
          {Array.from(new Set(nodes.map(n => n.type))).map(type => (
            <div key={type} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full border border-gray-400"
                style={{ backgroundColor: getNodeColor(type) }}
              />
              <span className="text-xs capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md border">
        <h4 className="font-medium text-sm mb-2">Graph Stats</h4>
        <div className="space-y-1 text-xs">
          <div>Nodes: {nodes.length}</div>
          <div>Edges: {edges.length}</div>
          <div>Density: {((edges.length * 2) / (nodes.length * (nodes.length - 1))).toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}