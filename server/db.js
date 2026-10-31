/* global require, process, module, __dirname */

const {
  Pool
} = require('pg')

const path =
  require('path')

const {
  createDatabaseSslConfig
} = require('./dbConfig')


const host =
  String(
    process.env.DB_HOST ||
    ''
  ).trim()

const ssl =
  createDatabaseSslConfig({
    host,

    mode:
      process.env.DB_SSL ||
      'auto',

    caPath:
      path.join(
        __dirname,
        'global-bundle.pem'
      )
  })


const pool =
  new Pool({
    host,

    port:
      process.env.DB_PORT,

    database:
      process.env.DB_NAME,

    user:
      process.env.DB_USER,

    password:
      process.env.DB_PASSWORD,

    ssl
  })


module.exports = pool
