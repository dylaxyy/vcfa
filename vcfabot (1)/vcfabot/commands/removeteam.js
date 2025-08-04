import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

const OVERSEER_ROLE_DIVISIONS = {
  '1345337089209798766': 'eu_div_1', // EU Div 1 Overseer
  '1345337449924132956': 'eu_div_2', // EU Div 2 Overseer
  '1381269407229018114': 'eu_div_3', // EU Div 3 Overseer
  '1345498738503843931': 'na_div_1', // NA Div 1 Overseer
  '1345498853717315624': 'na_div_2', // NA Div 2 Overseer
  '1381269500745486336': 'na_div_3'  // NA Div 3 Overseer
};

const DIVISION_CHOICES = [
  { name: 'EU Div 1', value: 'eu_div_1' },
  { name: 'NA Div 1', value: 'na_div_1' },
  { name: 'EU Div 2', value: 'eu_div_2' },
  { name: 'NA Div 2', value: 'na_div_2' },
  { name: 'EU Div 3', value: 'eu_div_3' },
  { name: 'NA Div 3', value: 'na_div_3' },
  { name: 'All Divisions', value: 'all' }
];

const DIVISION_NAMES = {
  'eu_div_1': 'EU Div 1',
  'na_div_1': 'NA Div 1',
  'eu_div_2': 'EU Div 2',
  'na_div_2': 'NA Div 2',
  'eu_div_3': 'EU Div 3',
  'na_div_3': 'NA Div 3',
  'all': 'All Divisions'
};

export const data = new SlashCommandBuilder()
  .setName('removeteam')
  .setDescription('Overseer only: Remove a team or teams')
  .addStringOption(option =>
    option.setName('division')
      .setDescription('Division')
      .setRequired(true)
      .addChoices(...DIVISION_CHOICES)
  )
  .addRoleOption(option =>
    option.setName('teamrole')
      .setDescription('Team role to remove or "all" (@everyone)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function getLogChannelId(db) {
  const row = await db.get('SELECT channel_id FROM channels WHERE type = ?', ['logschannel']);
  return row?.channel_id || null;
}

export async function execute(interaction, db) {
  const member = interaction.member;

  const memberRoles = member.roles.cache.map(r => r.id);
  const allowedDivisions = memberRoles
    .filter(roleId => OVERSEER_ROLE_DIVISIONS[roleId])
    .map(roleId => OVERSEER_ROLE_DIVISIONS[roleId]);

  if (allowedDivisions.length === 0) {
    return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
  }

  const division = interaction.options.getString('division');
  const role = interaction.options.getRole('teamrole');

  if (division !== 'all' && !allowedDivisions.includes(division)) {
    return interaction.reply({
      content: `❌ You can only remove teams from your own division(s): ${allowedDivisions.map(d => DIVISION_NAMES[d]).join(', ')}`,
      ephemeral: true
    });
  }

  const logChannelId = await getLogChannelId(db);
  const logChannel = logChannelId ? interaction.guild.channels.cache.get(logChannelId) : null;

  if (division === 'all' && role.id === interaction.guild.roles.everyone.id) {
    if (allowedDivisions.length !== Object.keys(OVERSEER_ROLE_DIVISIONS).length) {
      return interaction.reply({
        content: '❌ You cannot remove all teams from all divisions unless you have permission for all.',
        ephemeral: true
      });
    }
    await db.run('DELETE FROM teams');
    await interaction.reply({ content: '✅ All teams removed from all divisions.', ephemeral: true });
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🗑️ All Teams Removed')
        .setDescription(`${interaction.user.tag} removed all teams from all divisions.`)
        .setColor('Red')
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
    return;
  }

  if (role.id === interaction.guild.roles.everyone.id) {
    await db.run('DELETE FROM teams WHERE division = ?', division);
    await interaction.reply({ content: `✅ All teams removed from ${DIVISION_NAMES[division]}.`, ephemeral: true });
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Teams Removed')
        .setDescription(`${interaction.user.tag} removed all teams from ${DIVISION_NAMES[division]}.`)
        .setColor('Red')
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
    return;
  }

  // Remove specific team role from division(s)
  if (division === 'all') {
    const result = await db.run('DELETE FROM teams WHERE team_id = ?', role.id);
    if (result.changes === 0) {
      return interaction.reply({ content: '❌ No such team found in any division.', ephemeral: true });
    }
    await interaction.reply({ content: `✅ Team **${role.name}** removed from all divisions.`, ephemeral: true });
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Team Removed')
        .setDescription(`${interaction.user.tag} removed team **${role.name}** from all divisions.`)
        .setColor('Red')
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
    return;
  } else {
    const result = await db.run('DELETE FROM teams WHERE team_id = ? AND division = ?', [role.id, division]);
    if (result.changes === 0) {
      return interaction.reply({ content: '❌ No such team found in that division.', ephemeral: true });
    }
    await interaction.reply({ content: `✅ Team **${role.name}** removed from ${DIVISION_NAMES[division]}.`, ephemeral: true });
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Team Removed')
        .setDescription(`${interaction.user.tag} removed team **${role.name}** from ${DIVISION_NAMES[division]}.`)
        .setColor('Red')
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
    return;
  }
}
