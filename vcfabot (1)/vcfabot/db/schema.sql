PRAGMA foreign_keys = ON;

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  team_id TEXT PRIMARY KEY,
  team_name TEXT NOT NULL UNIQUE,
  division TEXT NOT NULL
);

-- Players table (with stats)
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
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE SET NULL
);

-- Channels for logging, etc.
CREATE TABLE IF NOT EXISTS channels (
  type TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL
);

-- Fixtures table: holds scheduled matches
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

-- Results table: stores final scores of fixtures
CREATE TABLE IF NOT EXISTS results (
  result_id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id INTEGER NOT NULL UNIQUE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  submitted_at DATETIME NOT NULL,
  FOREIGN KEY(fixture_id) REFERENCES fixtures(fixture_id) ON DELETE CASCADE
);

-- Player stats table for aggregated stats
CREATE TABLE IF NOT EXISTS player_stats (
  player_id TEXT PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  FOREIGN KEY(player_id) REFERENCES players(player_id) ON DELETE CASCADE
);

-- Team stats table for aggregated team performance
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
