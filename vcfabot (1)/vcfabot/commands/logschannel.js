import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('logschannel')
  .setDescription('Staff only: Set the channel where all logs will be sent')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('The channel to send logs to')
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
      ['logschannel', channel.id]
    );

    return interaction.reply({
      content: `✅ Logs will now be sent to ${channel}`,
      flags: 1 << 6 // Ephemeral flag
    });
  } catch (error) {
    console.error('Failed to set logs channel:', error);
    return interaction.reply({
      content: '❌ An error occurred while setting the logs channel.',
      flags: 1 << 6
    });
  }
}
