import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const DIVISIONS = [
  { name: 'EU Div 1', value: 'eu_div_1' },
  { name: 'NA Div 1', value: 'na_div_1' },
  { name: 'EU Div 2', value: 'eu_div_2' },
  { name: 'NA Div 2', value: 'na_div_2' },
  { name: 'EU Div 3', value: 'eu_div_3' },
  { name: 'NA Div 3', value: 'na_div_3' }
];

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Show stats for a player or division')
  .addUserOption(option =>
    option.setName('player')
      .setDescription('Player to show stats for')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('division')
      .setDescription('Division to show leaderboard for')
      .addChoices(...DIVISIONS)
      .setRequired(false)
  );

export async function execute(interaction, db) {
  const player = interaction.options.getUser('player');
  const division = interaction.options.getString('division');

  if (!player && !division) {
    return interaction.reply({ content: '❌ Please specify a player or a division.', ephemeral: true });
  }

  if (player) {
    // Fetch player stats
    const player_id = player.id;
    const row = await db.get('SELECT * FROM players WHERE player_id = ?', player_id);
    if (!row) {
      return interaction.reply({ content: `❌ No stats found for player ${player.tag}.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${player.tag}'s Stats`)
      .setColor('Blue')
      .addFields(
        { name: 'Games Played', value: `${row.games_played}`, inline: true },
        { name: 'Goals', value: `${row.goals_scored}`, inline: true },
        { name: 'Assists', value: `${row.assists || 0}`, inline: true },
        { name: 'Clean Sheets', value: `${row.clean_sheets || 0}`, inline: true },
        { name: 'Wins', value: `${row.wins}`, inline: true },
        { name: 'Draws', value: `${row.draws}`, inline: true },
        { name: 'Losses', value: `${row.losses}`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (division) {
    // Show division leaderboard

    // Get teams sorted by points desc
    const teams = await db.all(
      `SELECT t.team_name, ts.points, ts.games_played, ts.wins, ts.draws, ts.losses, ts.goals_for, ts.goals_against
       FROM teams t
       LEFT JOIN team_stats ts ON t.team_id = ts.team_id
       WHERE t.division = ?
       ORDER BY ts.points DESC, (ts.goals_for - ts.goals_against) DESC, ts.goals_for DESC`,
      division
    );

    if (!teams.length) {
      return interaction.reply({ content: `❌ No teams found in division ${division}.`, ephemeral: true });
    }

    // Get top scorers in this division (players with team in division)
    const topScorers = await db.all(
      `SELECT p.player_name, p.goals_scored, t.team_name
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.team_id
       WHERE t.division = ?
       ORDER BY p.goals_scored DESC
       LIMIT 5`,
      division
    );

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`League Table - ${division.toUpperCase().replace('_', ' ')}`)
      .setColor('Green');

    // Teams table text
    const tableText = teams.map((team, i) => {
      const gd = (team.goals_for || 0) - (team.goals_against || 0);
      return `**${i + 1}. ${team.team_name}** - Points: ${team.points || 0}, GP: ${team.games_played || 0}, W: ${team.wins || 0}, D: ${team.draws || 0}, L: ${team.losses || 0}, GF: ${team.goals_for || 0}, GA: ${team.goals_against || 0}, GD: ${gd}`;
    }).join('\n');

    embed.addFields({ name: 'Teams', value: tableText || 'No teams data' });

    // Top scorers text
    if (topScorers.length) {
      const scorersText = topScorers.map((p, i) => `${i + 1}. ${p.player_name} (${p.team_name || 'N/A'}) - Goals: ${p.goals_scored || 0}`).join('\n');
      embed.addFields({ name: 'Top Scorers', value: scorersText });
    }

    embed.setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
