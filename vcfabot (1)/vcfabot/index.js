import { Client, Collection, GatewayIntentBits, REST, Routes, ActivityType } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db/db.js';
import dotenv from 'dotenv';

dotenv.config(); // Load .env or Replit secrets

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '✅ present' : '❌ missing');
console.log('CLIENT_ID:', process.env.CLIENT_ID ? '✅ present' : '❌ missing');
console.log('GUILD_ID:', process.env.GUILD_ID ? '✅ present' : '❌ missing');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];

// Load commands asynchronously
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }
}

// Initialize the database once, before login
const db = await initDB();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  try {
    console.log('🔄 Refreshing application (/) commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands updated.');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }

  client.user.setPresence({
    activities: [{ name: 'VCFA League', type: ActivityType.Watching }],
    status: 'dnd'
  });
});

client.on('interactionCreate', async interaction => {
  try {
    // Handle select menu interaction for viewing backups
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_backup') {
      const selectedFile = interaction.values[0];
      const backupsFolder = path.join(__dirname, 'backups');
      const filePath = path.join(backupsFolder, selectedFile);

      if (!fs.existsSync(filePath)) {
        return interaction.update({
          content: `❌ Backup file not found: ${selectedFile}`,
          components: [],
          ephemeral: true,
        });
      }

      // Send backup file to user (ephemeral)
      await interaction.update({
        content: `📤 Sending backup file: **${selectedFile}**`,
        components: [],
        ephemeral: true,
        files: [{ attachment: filePath, name: selectedFile }]
      });
      return; // Exit after handling select menu
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Pass DB to commands
    await command.execute(interaction, db);

  } catch (error) {
    console.error(`❌ Error handling interaction:`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ There was an error processing your interaction.',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
