const mysql = require('mysql2/promise');
const winston = require('winston');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'personal_knowledge_graph',
  charset: 'utf8mb4',
  timezone: '+00:00',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/database.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Test database connection
pool.getConnection()
  .then(connection => {
    logger.info('Database connected successfully');
    connection.release();
  })
  .catch(error => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });

// Helper func.s
const db = {
  // Execute a query with parameters
  execute: async (sql, params = []) => {
    try {
      const [rows, fields] = await pool.execute(sql, params);
      return [rows, fields];
    } catch (error) {
      logger.error('Database query error:', { sql, params, error: error.message });
      throw error;
    }
  },

  // Execute a stored procedure
  callProcedure: async (procedureName, params = []) => {
    try {
      const placeholders = params.map(() => '?').join(', ');
      const sql = `CALL ${procedureName}(${placeholders})`;
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error('Stored procedure error:', { procedureName, params, error: error.message });
      throw error;
    }
  },

  // Begin transaction
  beginTransaction: async () => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    return connection;
  },

  // Commit transaction
  commitTransaction: async (connection) => {
    await connection.commit();
    connection.release();
  },

  // Rollback transaction
  rollbackTransaction: async (connection) => {
    await connection.rollback();
    connection.release();
  },

  // Get connection pool status
  getPoolStatus: () => {
    return {
      totalConnections: pool._allConnections.length,
      freeConnections: pool._freeConnections.length,
      acquiringConnections: pool._acquiringConnections.length,
      connectionLimit: pool.config.connectionLimit,
    };
  },

  // Close all connections
  close: async () => {
    await pool.end();
    logger.info('Database connection pool closed');
  },
};

module.exports = db;