const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,                 // số connection tối đa
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on("connect", () => {
  console.log("🟢 Connected to PostgreSQL (Neon)");
});

pool.on("error", (err) => {
  console.error("🔴 Unexpected PG error", err);
  process.exit(1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
