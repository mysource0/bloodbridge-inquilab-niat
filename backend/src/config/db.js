// backend/src/config/db.js
import { Pool } from 'pg';
import config from './config.js';

/**
 * Creates a new connection pool.
 * The pool manages multiple client connections to the database,
 * reusing them to improve performance and stability.
 */
const pool = new Pool({
  connectionString: config.databaseUrl,
});

/**
 * A helper function to execute a simple query.
 * @param {string} text - The SQL query string.
 * @param {Array} params - The parameters to pass to the query.
 * @returns {Promise<QueryResult>} The result from the database.
 */
const query = (text, params) => pool.query(text, params);

// We export the entire pool so we can use it for transactions later,
// and the query function for convenience.
const db = {
  query,
  pool,
};

export default db;