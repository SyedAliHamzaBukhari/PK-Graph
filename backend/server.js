const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import routes
const conceptRoutes = require('./routes/concepts');
const noteRoutes = require('./routes/notes');
const linkRoutes = require('./routes/links');
const searchRoutes = require('./routes/search');
const graphRoutes = require('./routes/graph');
const analyticsRoutes = require('./routes/analytics');

// Import database connection
const db = require('./config/database');

// Import graph utilities
const GraphUtils = require('./utils/graphUtils');

// Initialize Express app
const app = express();

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pkg-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Request ID middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.id,
  });
});

// API routes
app.use('/api/concepts', conceptRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/analytics', analyticsRoutes);

// Graph visualization endpoint
app.get('/api/graph/visualization', async (req, res) => {
  try {
    const { conceptId, depth = 2 } = req.query;
    
    // Get graph data using GraphUtils
    const graphData = await GraphUtils.getVisualizationData(conceptId, parseInt(depth));
    
    res.json({
      success: true,
      data: graphData,
      requestId: req.id,
    });
  } catch (error) {
    logger.error('Error generating graph visualization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate graph visualization',
      requestId: req.id,
    });
  }
});

// Similarity analysis endpoint
app.get('/api/similarity/concepts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { threshold = 0.1, limit = 20 } = req.query;
    
    // Use stored procedure for similarity calculation
    const [results] = await db.execute(
      'CALL calculate_concept_similarity(?, ?, ?)',
      [id, threshold, limit]
    );
    
    res.json({
      success: true,
      data: results[0],
      requestId: req.id,
    });
  } catch (error) {
    logger.error('Error calculating concept similarity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate similarity',
      requestId: req.id,
    });
  }
});

// AI-powered content analysis endpoint
app.post('/api/ai/analyze-content', async (req, res) => {
  try {
    const { content, analysisType } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required',
        requestId: req.id,
      });
    }
    
    // Use z-ai-web-dev-sdk for content analysis
    const ZAI = require('z-ai-web-dev-sdk');
    const zai = await ZAI.create();
    
    let prompt = '';
    switch (analysisType) {
      case 'summary':
        prompt = `Please provide a concise summary of the following content:\n\n${content}`;
        break;
      case 'keywords':
        prompt = `Extract the main keywords and concepts from the following content:\n\n${content}`;
        break;
      case 'sentiment':
        prompt = `Analyze the sentiment of the following content:\n\n${content}`;
        break;
      default:
        prompt = `Analyze the following content and provide insights:\n\n${content}`;
    }
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant specialized in content analysis.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    });
    
    const analysis = completion.choices[0]?.message?.content || 'Analysis failed';
    
    res.json({
      success: true,
      data: {
        analysis,
        type: analysisType || 'general',
      },
      requestId: req.id,
    });
  } catch (error) {
    logger.error('Error in AI content analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze content',
      requestId: req.id,
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    requestId: req.id,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    requestId: req.id,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info(`Personal Knowledge Graph API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;