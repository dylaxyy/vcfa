import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType,
} from 'discord.js';

const STAFF_ROLE_ID = '1345334427923910706';
const timeMultipliers = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  wk: 7 * 24 * 60 * 60 * 1000,
};

function parseDuration(input) {
  const match = input.trim().toLowerCase().match(/^(\d+)(s|m|h|d|wk)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  return value * timeMultipliers[unit];
}

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Host a giveaway (staff only)')
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duration (e.g. 1m, 2h, 1d, 1wk)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('prize')
      .setDescription('The prize for the giveaway')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName('winners')
      .setDescription('Number of winners')
      .setRequired(true)
  );

export async function execute(interaction) {
  const member = interaction.member;
  if (!member.roles.cache.has(STAFF_ROLE_ID)) {
    return interaction.reply({
      content: '❌ Only staff can use this command.',
      ephemeral: true
    });
  }

  const durationInput = interaction.options.getString('duration');
  const prize = interaction.options.getString('prize');
  const winnerCount = interaction.options.getInteger('winners');
  const durationMs = parseDuration(durationInput);

  if (!durationMs || durationMs > 7 * 24 * 60 * 60 * 1000) {
    return interaction.reply({
      content: '❌ Invalid duration. Use format like `1m`, `1h`, `2d`, `1wk` (max 7 days).',
      ephemeral: true
    });
  }

  const endTime = Date.now() + durationMs;
  const entrants = new Set();

  const embed = new EmbedBuilder()
    .setTitle(`🎁 ${prize} 🎁`)
    .addFields(
      { name: 'Total Winners:', value: `${winnerCount}`, inline: true },
      { name: 'Ends in:', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
      { name: 'Hosted By:', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setColor('Gold')
    .setTimestamp();

  const joinButton = new ButtonBuilder()
    .setCustomId('join_giveaway')
    .setLabel('🎉 Join Giveaway')
    .setStyle(ButtonStyle.Success);

  const countButton = new ButtonBuilder()
    .setCustomId('entrants_count')
    .setLabel('Entrants: 0')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row = new ActionRowBuilder().addComponents(joinButton, countButton);

  const message = await interaction.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: durationMs
  });

  collector.on('collect', async i => {
    if (i.customId === 'join_giveaway') {
      if (entrants.has(i.user.id)) {
        await i.reply({ content: '❗ You already joined!', ephemeral: true });
      } else {
        entrants.add(i.user.id);
        await i.reply({ content: '🎉 You joined the giveaway!', ephemeral: true });

        // Update entrant count
        const updatedCount = new ButtonBuilder()
          .setCustomId('entrants_count')
          .setLabel(`Entrants: ${entrants.size}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const updatedRow = new ActionRowBuilder().addComponents(joinButton, updatedCount);
        await message.edit({ components: [updatedRow] });
      }
    }
  });

  collector.on('end', async () => {
    const entrantArray = Array.from(entrants);
    if (entrantArray.length === 0) {
      await interaction.followUp('❌ Giveaway ended with no participants.');
      return;
    }

    const winners = [];
    for (let i = 0; i < Math.min(winnerCount, entrantArray.length); i++) {
      const winner = entrantArray.splice(Math.floor(Math.random() * entrantArray.length), 1)[0];
      winners.push(`<@${winner}>`);
    }

    await interaction.followUp({
      content: `🎊 Giveaway ended! Winner(s) for **${prize}**:\n${winners.join('\n')}`
    });
  });
}
