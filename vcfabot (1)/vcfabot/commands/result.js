import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const OVERSEER_DIVISIONS = {
  '1345337089209798766': 'eu_div_1',
  '1345337449924132956': 'eu_div_2',
  '1381269407229018114': 'eu_div_3',
  '1345498738503843931': 'na_div_1',
  '1345498853717315624': 'na_div_2',
  '1381269500745486336': 'na_div_3'
};

export const data = new SlashCommandBuilder()
  .setName('result')
  .setDescription('Submit a fixture result for your division')
  .addStringOption(opt => opt
    .setName('division')
    .setDescription('Division')
    .setRequired(true)
    .addChoices(
      { name: 'EU Div 1', value: 'eu_div_1' },
      { name: 'EU Div 2', value: 'eu_div_2' },
      { name: 'EU Div 3', value: 'eu_div_3' },
      { name: 'NA Div 1', value: 'na_div_1' },
      { name: 'NA Div 2', value: 'na_div_2' },
      { name: 'NA Div 3', value: 'na_div_3' }
    )
  )
  .addIntegerOption(opt => opt
    .setName('game_week')
    .setDescription('Game week number')
    .setRequired(true)
  )
  .addStringOption(opt => opt
    .setName('home_team')
    .setDescription('Home team ID (slug)')
    .setRequired(true)
  )
  .addStringOption(opt => opt
    .setName('away_team')
    .setDescription('Away team ID (slug)')
    .setRequired(true)
  )
  .addIntegerOption(opt => opt
    .setName('home_score')
    .setDescription('Home team score')
    .setRequired(true)
  )
  .addIntegerOption(opt => opt
    .setName('away_score')
    .setDescription('Away team score')
    .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function getUserDivisions(member) {
  return member.roles.cache
    .filter(role => Object.keys(OVERSEER_DIVISIONS).includes(role.id))
    .map(role => OVERSEER_DIVISIONS[role.id]);
}

export async function execute(interaction, db) {
  const member = interaction.member;

  const division = interaction.options.getString('division');
  const game_week = interaction.options.getInteger('game_week');
  const home_team_id = interaction.options.getString('home_team');
  const away_team_id = interaction.options.getString('away_team');
  const home_score = interaction.options.getInteger('home_score');
  const away_score = interaction.options.getInteger('away_score');

  const userDivisions = getUserDivisions(member);
  if (!userDivisions.includes(division)) {
    return interaction.reply({ content: '❌ You are not authorized for this division.', ephemeral: true });
  }

  // Check fixture exists and not completed
  const fixture = await db.get(`
    SELECT * FROM fixtures
    WHERE division = ? AND game_week = ? AND home_team_id = ? AND away_team_id = ?`,
    [division, game_week, home_team_id, away_team_id]
  );

  if (!fixture) {
    return interaction.reply({ content: '❌ No such fixture found.', ephemeral: true });
  }
  if (fixture.completed) {
    return interaction.reply({ content: '❌ This fixture result has already been submitted.', ephemeral: true });
  }

  // Insert or update results table
  await db.run(`
    INSERT INTO results (fixture_id, home_score, away_score, submitted_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(fixture_id) DO UPDATE SET
      home_score=excluded.home_score,
      away_score=excluded.away_score,
      submitted_at=CURRENT_TIMESTAMP
  `, [fixture.fixture_id, home_score, away_score]);

  // Update fixture completed flag
  await db.run(`UPDATE fixtures SET completed = 1 WHERE fixture_id = ?`, [fixture.fixture_id]);

  // Update team stats (simplified)
  const homeGoalsFor = home_score;
  const homeGoalsAgainst = away_score;
  const awayGoalsFor = away_score;
  const awayGoalsAgainst = home_score;

  // Fetch existing stats or initialize
  async function upsertTeamStats(team_id, gf, ga, win, draw, loss, points) {
    const stats = await db.get('SELECT * FROM team_stats WHERE team_id = ?', team_id);
    if (stats) {
      await db.run(`
        UPDATE team_stats SET
          games_played = games_played + 1,
          wins = wins + ?,
          draws = draws + ?,
          losses = losses + ?,
          goals_for = goals_for + ?,
          goals_against = goals_against + ?,
          points = points + ?
        WHERE team_id = ?
      `, [win, draw, loss, gf, ga, points, team_id]);
    } else {
      await db.run(`
        INSERT INTO team_stats
        (team_id, games_played, wins, draws, losses, goals_for, goals_against, points)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?)
      `, [team_id, win, draw, loss, gf, ga, points]);
    }
  }

  // Calculate results
  let homeWin = 0, homeDraw = 0, homeLoss = 0;
  let awayWin = 0, awayDraw = 0, awayLoss = 0;
  let homePoints = 0, awayPoints = 0;

  if (home_score > away_score) {
    homeWin = 1; awayLoss = 1; homePoints = 3;
  } else if (home_score < away_score) {
    awayWin = 1; homeLoss = 1; awayPoints = 3;
  } else {
    homeDraw = 1; awayDraw = 1; homePoints = 1; awayPoints = 1;
  }

  await upsertTeamStats(home_team_id, homeGoalsFor, homeGoalsAgainst, homeWin, homeDraw, homeLoss, homePoints);
  await upsertTeamStats(away_team_id, awayGoalsFor, awayGoalsAgainst, awayWin, awayDraw, awayLoss, awayPoints);

  // TODO: update player stats if you want here

  // Log to logs channel if set
  const logChannelRow = await db.get('SELECT channel_id FROM channels WHERE type = ?', 'logs');
  if (logChannelRow) {
    const logChannel = await interaction.client.channels.fetch(logChannelRow.channel_id).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send(`Result submitted for ${division} Gameweek ${game_week}:
      ${home_team_id} ${home_score} - ${away_score} ${away_team_id}`);
    }
  }

  return interaction.reply({ content: '✅ Result submitted and stats updated.', ephemeral: true });
}
