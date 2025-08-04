import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Change this to current directory so Replit can write:
const dbPath = path.join(__dirname, 'database.sqlite');

export async function initDB() {
  // Open database with read/write and create mode to avoid readonly error
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  });

  await db.exec('PRAGMA foreign_keys = ON;');

  // Create core tables if not exist, adjusted teams table UNIQUE constraint:
  await db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      team_id TEXT PRIMARY KEY,
      team_name TEXT NOT NULL,
      division TEXT NOT NULL,
      UNIQUE(team_name, division)
    );

    CREATE INDEX IF NOT EXISTS idx_teams_division ON teams(division);

    CREATE TABLE IF NOT EXISTS players (
      player_id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      team_id TEXT,
      points INTEGER DEFAULT 0,
      goals_scored INTEGER DEFAULT 0,
      goals_conceded INTEGER DEFAULT 0,
      goal_difference INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      FOREIGN KEY(team_id) REFERENCES teams(team_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);

    CREATE TABLE IF NOT EXISTS channels (
      type TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      fixture_id INTEGER PRIMARY KEY AUTOINCREMENT,
      division TEXT NOT NULL,
      game_week INTEGER NOT NULL,
      home_team_id TEXT NOT NULL,
      away_team_id TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      deadline DATETIME NOT NULL,
      completed BOOLEAN DEFAULT 0,
      UNIQUE(division, game_week, home_team_id, away_team_id),
      FOREIGN KEY(home_team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
      FOREIGN KEY(away_team_id) REFERENCES teams(team_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fixtures_division_gameweek ON fixtures(division, game_week);

    CREATE TABLE IF NOT EXISTS results (
      result_id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER NOT NULL UNIQUE,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      submitted_at DATETIME NOT NULL,
      FOREIGN KEY(fixture_id) REFERENCES fixtures(fixture_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      player_id TEXT PRIMARY KEY,
      games_played INTEGER DEFAULT 0,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      clean_sheets INTEGER DEFAULT 0,
      FOREIGN KEY(player_id) REFERENCES players(player_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_stats (
      team_id TEXT PRIMARY KEY,
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      goals_for INTEGER DEFAULT 0,
      goals_against INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      FOREIGN KEY(team_id) REFERENCES teams(team_id) ON DELETE CASCADE
    );
  `);

  // Migration helper: check and add missing columns in players (just in case)
  const columns = await db.all("PRAGMA table_info(players);");
  const colNames = columns.map(c => c.name);

  const playerColumnsToAdd = [
    { name: 'points', def: 'INTEGER DEFAULT 0' },
    { name: 'goals_scored', def: 'INTEGER DEFAULT 0' },
    { name: 'goals_conceded', def: 'INTEGER DEFAULT 0' },
    { name: 'goal_difference', def: 'INTEGER DEFAULT 0' },
    { name: 'games_played', def: 'INTEGER DEFAULT 0' },
    { name: 'wins', def: 'INTEGER DEFAULT 0' },
    { name: 'losses', def: 'INTEGER DEFAULT 0' },
    { name: 'draws', def: 'INTEGER DEFAULT 0' },
  ];

  for (const col of playerColumnsToAdd) {
    if (!colNames.includes(col.name)) {
      await db.exec(`ALTER TABLE players ADD COLUMN ${col.name} ${col.def};`);
    }
  }

  // Similarly, migrate team_stats table columns if needed
  const teamStatsColumns = await db.all("PRAGMA table_info(team_stats);");
  const teamStatsColNames = teamStatsColumns.map(c => c.name);

  const teamStatsColumnsToAdd = [
    { name: 'games_played', def: 'INTEGER DEFAULT 0' },
    { name: 'wins', def: 'INTEGER DEFAULT 0' },
    { name: 'draws', def: 'INTEGER DEFAULT 0' },
    { name: 'losses', def: 'INTEGER DEFAULT 0' },
    { name: 'goals_for', def: 'INTEGER DEFAULT 0' },
    { name: 'goals_against', def: 'INTEGER DEFAULT 0' },
    { name: 'points', def: 'INTEGER DEFAULT 0' },
  ];

  for (const col of teamStatsColumnsToAdd) {
    if (!teamStatsColNames.includes(col.name)) {
      await db.exec(`ALTER TABLE team_stats ADD COLUMN ${col.name} ${col.def};`);
    }
  }

  console.log('✅ Database initialization and migration done.');

  return db;
}
