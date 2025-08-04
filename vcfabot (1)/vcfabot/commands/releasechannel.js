import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('releasechannel')
  .setDescription('Staff only: Set the channel where release logs will be sent')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('The channel to send release logs to')
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
      ['releasechannel', channel.id]
    );

    // Fetch the main logs channel ID from the DB
    const logRow = await db.get('SELECT channel_id FROM channels WHERE type = ?', ['logschannel']);
    const logChannelId = logRow?.channel_id;

    if (logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔧 Release Logs Channel Updated')
          .setDescription(`${interaction.user.tag} set the release logs channel to ${channel}.`)
          .setColor('Orange')
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    }

    return interaction.reply({
      content: `✅ Release logs will now be sent to ${channel}`,
      flags: 1 << 6 // Ephemeral flag
    });
  } catch (error) {
    console.error('Failed to set release channel:', error);
    return interaction.reply({
      content: '❌ An error occurred while setting the release channel.',
      flags: 1 << 6
    });
  }
}
