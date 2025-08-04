import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function updateSchema() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  // Add missing columns if they don't exist
  // SQLite doesn't support IF NOT EXISTS for ADD COLUMN,
  // so we use try/catch to ignore errors if columns already exist
  const columnsToAdd = [
    'points INTEGER DEFAULT 0',
    'goals_scored INTEGER DEFAULT 0',
    'goals_conceded INTEGER DEFAULT 0',
    'games_played INTEGER DEFAULT 0',
    'games_won INTEGER DEFAULT 0',
    'games_drawn INTEGER DEFAULT 0',
    'games_lost INTEGER DEFAULT 0'
  ];

  for (const colDef of columnsToAdd) {
    const colName = colDef.split(' ')[0];
    try {
      await db.run(`ALTER TABLE teams ADD COLUMN ${colDef}`);
      console.log(`Added column: ${colName}`);
    } catch (err) {
      if (err.message.includes('duplicate column name')) {
        console.log(`Column ${colName} already exists, skipping.`);
      } else {
        console.error(`Error adding column ${colName}:`, err);
      }
    }
  }

  await db.close();
  console.log('Schema update complete.');
}

updateSchema().catch(console.error);
