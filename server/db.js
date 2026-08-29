/* global require, process, module, __dirname */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(
      path.join(__dirname, 'global-bundle.pem')
    ).toString()
  }
})

module.exports = pool