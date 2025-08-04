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
  .setName('sign')
  .setDescription('Signs a player to your team')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Player to sign')
      .setRequired(true)
  );

export async function execute(interaction, db) {
  const user = interaction.options.getUser('user');
  if (!user) {
    return interaction.reply({ content: '❌ You must specify a user to sign.', ephemeral: true });
  }

  const manager = interaction.member;

  // Check manager role
  const hasManagerRole = manager.roles.cache.some(role => MANAGER_ROLES.includes(role.id));
  if (!hasManagerRole) {
    return interaction.reply({ content: '❌ You do not have a manager role.', ephemeral: true });
  }

  // Find the team role(s) that the manager has which exist in the DB
  const managerTeamRoles = [];

  // Get all team roles from DB
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

  // Prepare DM confirmation buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('sign_accept')
      .setLabel('Yes')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('sign_decline')
      .setLabel('No')
      .setStyle(ButtonStyle.Danger)
  );

  const dmContent = `Hello ${user.username}! The team **${team.team_name}** is trying to sign you in VCFA! Do you accept?`;

  const dm = await user.send({ content: dmContent, components: [row] }).catch(() => null);

  if (!dm) {
    return interaction.reply({ content: '❌ Could not send a DM to that user.', ephemeral: true });
  }

  await interaction.reply({ content: '✅ Request sent to the player.', ephemeral: true });

  // Collector for button interaction
  const collector = dm.createMessageComponentCollector({ time: 0 });

  collector.on('collect', async i => {
    if (i.user.id !== user.id) return;

    if (i.customId === 'sign_accept') {
      await targetMember.roles.add(team.team_id);

      // Send logs to signingschannel and logschannel if set
      const signingLog = await getChannel(db, 'signingschannel');
      const logsLog = await getChannel(db, 'logschannel');

      const embed = new EmbedBuilder()
        .setTitle('📥 Player Signed')
        .setDescription(`${user.tag} has joined **${team.team_name}** by request of ${manager.user.tag}`)
        .setColor('Green')
        .setTimestamp();

      if (signingLog) interaction.guild.channels.cache.get(signingLog)?.send({ embeds: [embed] });
      if (logsLog) interaction.guild.channels.cache.get(logsLog)?.send({ embeds: [embed] });

      await i.update({ content: '✅ You have joined the team!', components: [] });
      collector.stop();
    }

    if (i.customId === 'sign_decline') {
      await i.update({ content: '❌ You declined the request.', components: [] });
      collector.stop();
    }
  });
}

// Helper to get a channel ID from the DB
async function getChannel(db, type) {
  const row = await db.get('SELECT channel_id FROM channels WHERE type = ?', [type]);
  return row?.channel_id || null;
}
