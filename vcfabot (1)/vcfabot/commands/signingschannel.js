import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('signingschannel')
  .setDescription('Staff only: Set the channel where signing logs will be sent')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('The channel to send signing logs to')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, db) {
  const channel = interaction.options.getChannel('channel');

  try {
    await db.run(
      `INSERT INTO channels (type, channel_id)
       VALUES (?, ?)
       ON CONFLICT(type) DO UPDATE SET channel_id = excluded.channel_id`,
      ['signingschannel', channel.id]
    );

    // Fetch the current logschannel from the DB
    const logRow = await db.get('SELECT channel_id FROM channels WHERE type = ?', ['logschannel']);
    const logChannelId = logRow?.channel_id;

    if (logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔧 Signing Logs Channel Updated')
          .setDescription(`${interaction.user.tag} set the signing logs channel to ${channel}.`)
          .setColor('Orange')
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    }

    return interaction.reply({
      content: `✅ Signing logs will now be sent to ${channel}`,
      flags: 1 << 6 // Ephemeral flag
    });
  } catch (error) {
    console.error('Failed to set signings channel:', error);
    return interaction.reply({
      content: '❌ An error occurred while setting the signings channel.',
      flags: 1 << 6
    });
  }
}
