import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

const OVERSEER_ROLE_DIVISIONS = {
  '1345337089209798766': 'eu_div_1', // EU Div 1 Overseer
  '1345337449924132956': 'eu_div_2', // EU Div 2 Overseer
  '1381269407229018114': 'eu_div_3', // EU Div 3 Overseer
  '1345498738503843931': 'na_div_1', // NA Div 1 Overseer
  '1345498853717315624': 'na_div_2', // NA Div 2 Overseer
  '1381269500745486336': 'na_div_3'  // NA Div 3 Overseer
};

const DIVISION_LIMITS = {
  'eu_div_1': 12,
  'na_div_1': 12,
  'eu_div_2': 14,
  'na_div_2': 14,
  'eu_div_3': 14,
  'na_div_3': 14
};

const DIVISION_NAMES = {
  'eu_div_1': 'EU Div 1',
  'na_div_1': 'NA Div 1',
  'eu_div_2': 'EU Div 2',
  'na_div_2': 'NA Div 2',
  'eu_div_3': 'EU Div 3',
  'na_div_3': 'NA Div 3'
};

export const data = new SlashCommandBuilder()
  .setName('addteam')
  .setDescription('Overseer only: Add a team to a division')
  .addRoleOption(option =>
    option.setName('teamrole')
      .setDescription('Role to add as a team')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('division')
      .setDescription('Division to add team to')
      .setRequired(true)
      .addChoices(
        { name: 'EU Div 1', value: 'eu_div_1' },
        { name: 'NA Div 1', value: 'na_div_1' },
        { name: 'EU Div 2', value: 'eu_div_2' },
        { name: 'NA Div 2', value: 'na_div_2' },
        { name: 'EU Div 3', value: 'eu_div_3' },
        { name: 'NA Div 3', value: 'na_div_3' }
      )
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
    return interaction.reply({ content: '❌ You are not authorized to use this command.', flags: 64 }); // ephemeral flag 64
  }

  const teamRole = interaction.options.getRole('teamrole');
  const division = interaction.options.getString('division');

  if (!allowedDivisions.includes(division)) {
    return interaction.reply({
      content: `❌ You can only add teams to your own division(s): ${allowedDivisions.map(d => DIVISION_NAMES[d]).join(', ')}`,
      flags: 64
    });
  }

  // Check if this team role is already assigned (team_id unique)
  const alreadyAssigned = await db.get('SELECT * FROM teams WHERE team_id = ?', teamRole.id);
  if (alreadyAssigned) {
    return interaction.reply({ content: `❌ This team role is already registered in division **${DIVISION_NAMES[alreadyAssigned.division]}**.`, flags: 64 });
  }

  // Check if team name already exists in this division (team_name, division uniqueness)
  const duplicateName = await db.get('SELECT * FROM teams WHERE team_name = ? AND division = ?', [teamRole.name, division]);
  if (duplicateName) {
    return interaction.reply({
      content: `❌ A team named **${teamRole.name}** already exists in ${DIVISION_NAMES[division]}.`,
      flags: 64
    });
  }

  // Count current teams in division
  const row = await db.get('SELECT COUNT(*) as count FROM teams WHERE division = ?', division);
  const count = row?.count || 0;

  if (count >= DIVISION_LIMITS[division]) {
    return interaction.reply({ content: `❌ Division **${DIVISION_NAMES[division]}** already has max teams (${DIVISION_LIMITS[division]}).`, flags: 64 });
  }

  // Insert team
  await db.run('INSERT INTO teams (team_id, team_name, division) VALUES (?, ?, ?)', [teamRole.id, teamRole.name, division]);

  // Send reply
  await interaction.reply({ content: `✅ Team **${teamRole.name}** added to ${DIVISION_NAMES[division]}.`, flags: 64 });

  // Log to logs channel
  const logChannelId = await getLogChannelId(db);
  if (logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🆕 Team Added')
        .setDescription(`${interaction.user.tag} added team **${teamRole.name}** to ${DIVISION_NAMES[division]}.`)
        .setColor('Green')
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }
  }
}
