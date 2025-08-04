import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const STAFF_ROLE_ID = '1345334427923910706';

export const data = new SlashCommandBuilder()
  .setName('rerollgiveaway')
  .setDescription('Staff only: Reroll the most recent giveaway in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const member = interaction.member;
  if (!member.roles.cache.has(STAFF_ROLE_ID)) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  // Fetch recent messages in the channel
  const messages = await interaction.channel.messages.fetch({ limit: 50 });
  const giveawayMsg = messages.find(m =>
    m.embeds.length > 0 &&
    m.reactions.cache.has('🎉') &&
    m.embeds[0].title?.includes('Giveaway')
  );

  if (!giveawayMsg) {
    return interaction.reply({ content: '❌ No recent giveaway found in this channel.', ephemeral: true });
  }

  const embed = giveawayMsg.embeds[0];
  const prizeMatch = embed.description.match(/Prize: \*\*(.+?)\*\*/);
  const winnersMatch = embed.description.match(/Winners: \*\*(\d+)\*\*/);

  const prize = prizeMatch?.[1];
  const winnersCount = parseInt(winnersMatch?.[1]);

  if (!prize || !winnersCount) {
    return interaction.reply({ content: '❌ Could not parse prize or winner count from the giveaway embed.', ephemeral: true });
  }

  const reaction = giveawayMsg.reactions.cache.get('🎉');
  const users = await reaction.users.fetch();
  const validUsers = users.filter(u => !u.bot);

  if (validUsers.size === 0) {
    return interaction.reply({ content: '❌ No valid users entered the giveaway.', ephemeral: true });
  }

  const winners = validUsers.random(winnersCount);
  const winnerMentions = Array.isArray(winners)
    ? winners.map(u => `<@${u.id}>`).join(', ')
    : `<@${winners.id}>`;

  const resultEmbed = new EmbedBuilder()
    .setTitle('🔁 Giveaway Rerolled!')
    .setDescription(`Prize: **${prize}**\nNew Winners: ${winnerMentions}`)
    .setColor('Blue')
    .setTimestamp();

  await interaction.reply({ content: '✅ Giveaway rerolled.', ephemeral: true });
  await interaction.channel.send({ embeds: [resultEmbed] });
}
