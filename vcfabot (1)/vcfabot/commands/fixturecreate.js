import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

// Division role IDs for overseers:
const OVERSEER_DIVISIONS = {
  '1345337089209798766': 'eu_div_1',
  '1345337449924132956': 'eu_div_2',
  '1381269407229018114': 'eu_div_3',
  '1345498738503843931': 'na_div_1',
  '1345498853717315624': 'na_div_2',
  '1381269500745486336': 'na_div_3'
};

export const data = new SlashCommandBuilder()
  .setName('fixturecreate')
  .setDescription('Create next game week fixtures for your overseer division')
  .addStringOption(option =>
    option.setName('division')
      .setDescription('Select division')
      .setRequired(true)
      .addChoices(
        { name: 'EU Div 1', value: 'eu_div_1' },
        { name: 'EU Div 2', value: 'eu_div_2' },
        { name: 'EU Div 3', value: 'eu_div_3' },
        { name: 'NA Div 1', value: 'na_div_1' },
        { name: 'NA Div 2', value: 'na_div_2' },
        { name: 'NA Div 3', value: 'na_div_3' },
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function getUserDivisions(member) {
  return member.roles.cache
    .filter(role => Object.keys(OVERSEER_DIVISIONS).includes(role.id))
    .map(role => OVERSEER_DIVISIONS[role.id]);
}

// Round robin algorithm for pairing teams:
function generateRoundRobinFixtures(teams, round) {
  const n = teams.length;
  if (n % 2 !== 0) teams.push(null); // Add bye if odd number of teams

  const pairings = [];
  const numRounds = n - 1;
  const half = n / 2;

  const rotated = teams.slice();

  for (let i = 0; i < numRounds; i++) {
    if (i === round - 1) {
      for (let j = 0; j < half; j++) {
        const home = rotated[j];
        const away = rotated[n - 1 - j];
        if (home && away) pairings.push([home, away]);
      }
      break;
    }
    // Rotate teams (except the first one)
    rotated.splice(1, 0, rotated.pop());
  }

  return pairings;
}

export async function execute(interaction, db) {
  const member = interaction.member;
  const division = interaction.options.getString('division');

  // Check user is overseer and division matches one of their roles
  const userDivisions = getUserDivisions(member);
  if (!userDivisions.includes(division)) {
    return interaction.reply({ content: '❌ You are not authorized for this division.', ephemeral: true });
  }

  // Get all teams in division
  const teamsRows = await db.all('SELECT team_id FROM teams WHERE division = ?', division);
  const teams = teamsRows.map(row => row.team_id);
  if (teams.length < 2) {
    return interaction.reply({ content: '❌ Not enough teams in this division to create fixtures.', ephemeral: true });
  }

  // Find last game_week used for this division
  const lastGameWeekRow = await db.get('SELECT MAX(game_week) AS maxWeek FROM fixtures WHERE division = ?', division);
  const nextGameWeek = (lastGameWeekRow?.maxWeek || 0) + 1;

  // Generate fixtures for this game week
  const fixtures = generateRoundRobinFixtures(teams, nextGameWeek);

  if (fixtures.length === 0) {
    return interaction.reply({ content: '❌ No fixtures to create this game week.', ephemeral: true });
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

  // Insert fixtures into DB
  const insertStmt = await db.prepare(`
    INSERT OR IGNORE INTO fixtures
    (division, game_week, home_team_id, away_team_id, created_at, deadline, completed)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);

  for (const [home, away] of fixtures) {
    await insertStmt.run(division, nextGameWeek, home, away, now.toISOString(), deadline.toISOString());
  }
  await insertStmt.finalize();

  return interaction.reply({
    content: `✅ Created fixtures for **${division}** game week ${nextGameWeek}. Deadline is ${deadline.toDateString()}.`,
    ephemeral: true
  });
}
