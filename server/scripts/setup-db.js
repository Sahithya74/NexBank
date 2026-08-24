'use strict';

/**
 * Creates the NexBank schema and loads the demo dataset.
 *
 *   npm run db:setup            schema + seed
 *   npm run db:setup -- --schema-only
 *
 * The seed file carries a __PASSWORD_HASH__ placeholder rather than a committed
 * hash; a fresh bcrypt hash of SEED_PASSWORD is generated here at load time.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

const DATABASE_DIR = path.resolve(__dirname, '..', '..', 'database');

async function run() {
  const schemaOnly = process.argv.includes('--schema-only');
  const seedOnly = process.argv.includes('--seed-only');

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    if (!seedOnly) {
      const schema = fs.readFileSync(path.join(DATABASE_DIR, 'schema.sql'), 'utf8');
      process.stdout.write('[nexbank] applying schema... ');
      await connection.query(schema);
      process.stdout.write('done\n');
    }

    if (!schemaOnly) {
      const passwordHash = await bcrypt.hash(config.seedPassword, config.auth.bcryptRounds);
      const seed = fs
        .readFileSync(path.join(DATABASE_DIR, 'seed.sql'), 'utf8')
        .replaceAll('__PASSWORD_HASH__', passwordHash);

      process.stdout.write('[nexbank] loading seed data... ');
      await connection.query(seed);
      process.stdout.write('done\n');

      console.log('\n  Demo accounts (password: %s)', config.seedPassword);
      console.log('  ------------------------------------------------');
      console.log('  Administrator   admin@nexbank.com');
      console.log('  Manager         manager@nexbank.com');
      console.log('  Bank employee   employee@nexbank.com');
      console.log('  Customer        meera@nexbank.com');
      console.log('  Customer        arjun@nexbank.com\n');
    }

    console.log('[nexbank] database ready.');
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('[nexbank] database setup failed:', error.message);
  process.exit(1);
});
