import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const DIVISION_CHOICES = [
  { name: 'EU Div 1', value: 'eu_div_1' },
  { name: 'NA Div 1', value: 'na_div_1' },
  { name: 'EU Div 2', value: 'eu_div_2' },
  { name: 'NA Div 2', value: 'na_div_2' },
  { name: 'EU Div 3', value: 'eu_div_3' },
  { name: 'NA Div 3', value: 'na_div_3' }
];

// Helper to make division pretty for embed title
function prettyDivision(div) {
  return div.toUpperCase().replace(/_/g, ' ');
}

export const data = new SlashCommandBuilder()
  .setName('leaguetable')
  .setDescription('Show the league table for a division')
  .addStringOption(option =>
    option.setName('division')
      .setDescription('Select a division')
      .setRequired(true)
      .addChoices(...DIVISION_CHOICES)
  );

export async function execute(interaction, db) {
  const division = interaction.options.getString('division');

  // Query teams and aggregate player stats
  const teams = await db.all(`
    SELECT
      t.team_name,
      IFNULL(SUM(p.points), 0) AS points,
      IFNULL(SUM(p.goals_scored), 0) AS goals_scored,
      IFNULL(SUM(p.goals_conceded), 0) AS goals_conceded,
      IFNULL(SUM(p.goal_difference), 0) AS goal_difference,
      IFNULL(SUM(p.games_played), 0) AS games_played,
      IFNULL(SUM(p.wins), 0) AS wins,
      IFNULL(SUM(p.losses), 0) AS losses,
      IFNULL(SUM(p.draws), 0) AS draws
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.team_id
    WHERE t.division = ?
    GROUP BY t.team_id
    ORDER BY points DESC, goal_difference DESC, goals_scored DESC,
      CAST(SUBSTR(t.team_name, INSTR(t.team_name, '︱') + 1) AS INTEGER) ASC
  `, [division]);

  if (teams.length === 0) {
    return interaction.reply({ content: `No teams found in division ${prettyDivision(division)}`, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`League Table - ${prettyDivision(division)}`)
    .setColor('Blue')
    .setTimestamp();

  let description = '🏆 **# | Team | Pts | GP | W | D | L | GS | GC | GD**\n\n';

  teams.forEach((team, index) => {
    description += `**${index + 1}.** ${team.team_name} | ${team.points} | ${team.games_played} | ${team.wins} | ${team.draws} | ${team.losses} | ${team.goals_scored} | ${team.goals_conceded} | ${team.goal_difference}\n`;
  });

  embed.setDescription(description);

  return interaction.reply({ embeds: [embed], ephemeral: false });
}
