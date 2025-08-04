import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

const MANAGER_ROLES = [
  '1345367713161412721', // EU MANAGER
  '1345369526060978278', // EU CO MANAGER
  '1345541692928823471', // NA MANAGER
  '1345541579636604958', // NA CO MANAGER
];

export const data = new SlashCommandBuilder()
  .setName('release')
  .setDescription('Releases a player from your team')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Player to release')
      .setRequired(true)
  );

export async function execute(interaction, db) {
  const user = interaction.options.getUser('user');
  if (!user) {
    return interaction.reply({ content: '❌ You must specify a user to release.', ephemeral: true });
  }

  const manager = interaction.member;

  // Check manager role
  const hasManagerRole = manager.roles.cache.some(role => MANAGER_ROLES.includes(role.id));
  if (!hasManagerRole) {
    return interaction.reply({ content: '❌ You do not have a manager role.', ephemeral: true });
  }

  // Find the team role(s) that the manager has which exist in the DB
  const managerTeamRoles = [];

  const teams = await db.all('SELECT team_id, team_name FROM teams');

  for (const team of teams) {
    if (manager.roles.cache.has(team.team_id)) {
      managerTeamRoles.push(team);
    }
  }

  if (managerTeamRoles.length === 0) {
    return interaction.reply({ content: '❌ You do not have a team role assigned in the database.', ephemeral: true });
  }
  if (managerTeamRoles.length > 1) {
    return interaction.reply({ content: '❌ You have more than one team role assigned, please only have one.', ephemeral: true });
  }

  const team = managerTeamRoles[0];

  // Fetch the target member from guild
  let targetMember;
  try {
    targetMember = await interaction.guild.members.fetch(user.id);
  } catch {
    return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
  }

  // Check if target actually has the team role
  if (!targetMember.roles.cache.has(team.team_id)) {
    return interaction.reply({ content: `❌ That user is not a member of **${team.team_name}**.`, ephemeral: true });
  }

  // Prepare DM confirmation buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('release_accept')
      .setLabel('Yes')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('release_decline')
      .setLabel('No')
      .setStyle(ButtonStyle.Danger)
  );

  const dmContent = `Hello ${user.username}! The team **${team.team_name}** is trying to release you in VCFA. Do you accept?`;

  const dm = await user.send({ content: dmContent, components: [row] }).catch(() => null);

  if (!dm) {
    return interaction.reply({ content: '❌ Could not send a DM to that user.', ephemeral: true });
  }

  await interaction.reply({ content: '✅ Release request sent to the player.', ephemeral: true });

  // Collector for button interaction
  const collector = dm.createMessageComponentCollector({ time: 0 });

  collector.on('collect', async i => {
    if (i.user.id !== user.id) return;

    if (i.customId === 'release_accept') {
      await targetMember.roles.remove(team.team_id);

      // Send logs to releasechannel and logschannel if set
      const releaseLog = await getChannel(db, 'releasechannel');
      const logsLog = await getChannel(db, 'logschannel');

      const embed = new EmbedBuilder()
        .setTitle('📤 Player Released')
        .setDescription(`${user.tag} has been released from **${team.team_name}** by request of ${manager.user.tag}`)
        .setColor('Red')
        .setTimestamp();

      if (releaseLog) interaction.guild.channels.cache.get(releaseLog)?.send({ embeds: [embed] });
      if (logsLog) interaction.guild.channels.cache.get(logsLog)?.send({ embeds: [embed] });

      await i.update({ content: '✅ You have been released from the team.', components: [] });
      collector.stop();
    }

    if (i.customId === 'release_decline') {
      await i.update({ content: '❌ You declined the release request.', components: [] });
      collector.stop();
    }
  });
}

// Helper to get a channel ID from the DB
async function getChannel(db, type) {
  const row = await db.get('SELECT channel_id FROM channels WHERE type = ?', [type]);
  return row?.channel_id || null;
}
