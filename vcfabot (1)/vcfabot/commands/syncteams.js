import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('syncteams')
  .setDescription('Staff only: Sync all team names in the database with their current role names')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, db) {
  const guild = interaction.guild;

  // Fetch all teams from the DB
  const teams = await db.all('SELECT team_id, team_name FROM teams');
  if (teams.length === 0) {
    return interaction.reply({ content: '❌ No teams found in the database.', ephemeral: true });
  }

  let updatedCount = 0;
  for (const team of teams) {
    const role = guild.roles.cache.get(team.team_id);
    if (role && role.name !== team.team_name) {
      await db.run('UPDATE teams SET team_name = ? WHERE team_id = ?', [role.name, team.team_id]);
      updatedCount++;
    }
  }

  // Log the result
  const embed = new EmbedBuilder()
    .setTitle('🔄 Team Names Synced')
    .setDescription(`✅ Updated **${updatedCount}** team name${updatedCount !== 1 ? 's' : ''} in the database.`)
    .setColor('Green')
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: false });
}
