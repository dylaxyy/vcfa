import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';

const allowedRoleIds = new Set([
  '1359253735225819521',
  '1382841858257850488',
  '1383911123023302766'
]);

export const data = new SlashCommandBuilder()
  .setName('backupdb')
  .setDescription('Create a backup of the database');

export async function execute(interaction) {
  // Check role permission
  const memberRoles = interaction.member.roles.cache;
  const hasAllowedRole = memberRoles.some(role => allowedRoleIds.has(role.id));

  if (!hasAllowedRole) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  try {
    const backupsFolder = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsFolder)) {
      fs.mkdirSync(backupsFolder);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sourcePath = path.join(process.cwd(), 'db', 'database.sqlite');
    const destPath = path.join(backupsFolder, `backup-${timestamp}.sqlite`);

    // Copy the database file to backups folder
    fs.copyFileSync(sourcePath, destPath);

    await interaction.reply({ content: `✅ Backup created successfully: \`${path.basename(destPath)}\``, ephemeral: false });
  } catch (error) {
    console.error('Failed to create backup:', error);
    await interaction.reply({ content: '❌ Failed to create backup.', ephemeral: false });
  }
}
