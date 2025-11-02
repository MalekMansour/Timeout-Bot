import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import fs from "fs";

const TOKEN = "";
const CLIENT_ID = "";
const ROLE_ID = null; 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const DATA_FILE = "./timeouts.json";
let timeouts = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(timeouts, null, 2));
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of Object.entries(timeouts)) {
    if (data.callUntil && data.callUntil < now) data.callUntil = null;
    if (data.textUntil && data.textUntil < now) data.textUntil = null;
    if (data.cooldownUntil && data.cooldownUntil < now) {
      data.cooldownUntil = null;
      data.cooldownGap = null;
      data.lastMsg = null;
    }
  }
  saveData();
}, 30 * 1000);

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const userId = msg.author.id;
  const data = timeouts[userId];
  if (!data) return;

  const now = Date.now();

  // Chat timeout
  if (data.textUntil && now < data.textUntil) {
    await msg.delete().catch(() => {});
    return msg.author
      .send("🚫 You’re muted and can’t send messages right now.")
      .catch(() => {});
  }

  if (data.cooldownUntil && now < data.cooldownUntil) {
    if (data.lastMsg && now - data.lastMsg < data.cooldownGap * 1000) {
      await msg.delete().catch(() => {});
      return msg.author
        .send(
          `⏳ You must wait ${data.cooldownGap}s between messages for now.`
        )
        .catch(() => {});
    }
    data.lastMsg = now;
    saveData();
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const member = newState.member;
  if (!member) return;

  const data = timeouts[member.id];
  if (!data || !data.callUntil) return;

  const now = Date.now();
  if (now < data.callUntil && newState.channelId) {
    try {
      await member.voice.disconnect("🚫 You’re voice-timed out.");
      console.log(`Disconnected ${member.user.tag} (voice timeout active).`);
    } catch (err) {
      console.error(`Failed to disconnect ${member.user.tag}:`, err);
    }
  }
});

// 🧱 Slash command setup
const commands = [
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Manage timeouts and cooldowns")
    .addSubcommand((sub) =>
      sub
        .setName("call")
        .setDescription("Timeout user from voice calls")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName("minutes").setDescription("Minutes").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("text")
        .setDescription("Timeout user from sending messages")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName("minutes").setDescription("Minutes").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove all timeouts for a user")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("cooldown")
        .setDescription("Put user on chat cooldown")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("gap")
            .setDescription("Seconds between allowed messages")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Duration in minutes")
            .setRequired(true)
        )
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
})();

// ⚔️ Command handling
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== "timeout") return;

  const member = interaction.member;
  const hasPermission =
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    (ROLE_ID && member.roles.cache.has(ROLE_ID));

  if (!hasPermission)
    return interaction.reply({
      content: "🚫 You don’t have permission to use this command.",
      ephemeral: true,
    });

  const sub = interaction.options.getSubcommand();
  const user = interaction.options.getUser("user");
  const targetId = user.id;
  const guildMember = await interaction.guild.members
    .fetch(targetId)
    .catch(() => null);

  timeouts[targetId] = timeouts[targetId] || {};
  const now = Date.now();

  switch (sub) {
    case "call": {
      const minutes = interaction.options.getInteger("minutes");
      timeouts[targetId].callUntil = now + minutes * 60 * 1000;
      saveData();

      // Immediately disconnect if user is in voice
      if (guildMember?.voice?.channel) {
        try {
          await guildMember.voice.disconnect("Voice timeout applied.");
          console.log(`🚫 Disconnected ${user.username} immediately.`);
        } catch (err) {
          console.error(`Failed to disconnect ${user.username}:`, err);
        }
      }

      interaction.reply(
        `🔇 ${user.username} has been voice-timed out for ${minutes} minutes.`
      );
      break;
    }

    case "text": {
      const minutes = interaction.options.getInteger("minutes");
      timeouts[targetId].textUntil = now + minutes * 60 * 1000;
      saveData();
      interaction.reply(
        `💬 ${user.username} has been muted from chat for ${minutes} minutes.`
      );
      break;
    }

    case "remove": {
      delete timeouts[targetId];
      saveData();
      interaction.reply(`✅ All timeouts removed for ${user.username}.`);
      break;
    }

    case "cooldown": {
      const gap = interaction.options.getInteger("gap");
      const duration = interaction.options.getInteger("duration");
      timeouts[targetId].cooldownGap = gap;
      timeouts[targetId].cooldownUntil = now + duration * 60 * 1000;
      timeouts[targetId].lastMsg = null;
      saveData();
      interaction.reply(
        `⏳ ${user.username} can now only send 1 message every ${gap}s for ${duration} minutes.`
      );
      break;
    }
  }
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
