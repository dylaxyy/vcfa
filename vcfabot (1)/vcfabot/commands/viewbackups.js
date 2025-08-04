import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

const allowedRoleIds = new Set([
  '1359253735225819521',
  '1382841858257850488',
  '1383911123023302766'
]);

export const data = new SlashCommandBuilder()
  .setName('viewbackups')
  .setDescription('View and download database backups');

export async function execute(interaction) {
  // Permission check
  const memberRoles = interaction.member.roles.cache;
  const hasAllowedRole = memberRoles.some(role => allowedRoleIds.has(role.id));
  if (!hasAllowedRole) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  const backupsFolder = path.join(process.cwd(), 'backups');

  if (!fs.existsSync(backupsFolder)) {
    return interaction.reply({ content: 'ℹ️ No backups folder found.', ephemeral: true });
  }

  const files = fs.readdirSync(backupsFolder)
    .filter(file => file.endsWith('.sqlite'))
    .map(file => {
      const fullPath = path.join(backupsFolder, file);
      const mtime = fs.statSync(fullPath).mtime;
      return { name: file, fullPath, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    return interaction.reply({ content: 'ℹ️ No backup files found.', ephemeral: true });
  }

  // Build select menu options (limit to max 25 options by Discord)
  const options = files.slice(0, 25).map(file => ({
    label: file.name.length > 100 ? file.name.slice(0, 97) + '...' : file.name,
    description: `Last modified: ${file.mtime.toLocaleString()}`,
    value: file.name,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_backup')
    .setPlaceholder('Select a backup to download')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: `📂 Select a backup from the dropdown to download it.`,
    components: [row],
    ephemeral: false,
  });
}
