import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import fs from "fs";

const TOKEN = "TOKEN";
const CLIENT_ID = "CLIENT ID";

const ALLOWED_ROLES = [
  "ROLE1",
  "ROLE2",
  "ROLE3",
];

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

// Cleanup expired timeouts
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

// Chat timeout & cooldown logic
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const userId = msg.author.id;
  const data = timeouts[userId];
  if (!data) return;

  const now = Date.now();

  if (data.textUntil && now < data.textUntil) {
    await msg.delete().catch(() => {});
    // ephemeral reply to the user
    return msg.channel
      .send({
        content: `🚫 <@${userId}>, you’re muted and can’t send messages.`,
      })
      .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000)); 
  }

  if (data.cooldownUntil && now < data.cooldownUntil) {
    if (data.lastMsg && now - data.lastMsg < data.cooldownGap * 1000) {
      await msg.delete().catch(() => {});
      return msg.channel
        .send({
          content: `⏳ <@${userId}>, you must wait ${data.cooldownGap}s between messages.`,
        })
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    data.lastMsg = now;
    saveData();
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const member = newState.member;
  if (!member) return;
  const data = timeouts[member.id];
  if (!data?.callUntil) return;

  const now = Date.now();
  if (now < data.callUntil && newState.channelId) {
    try {
      await member.voice.disconnect("🚫 Voice timeout active.");
    } catch (err) {
      console.error(`Failed to disconnect ${member.user.tag}:`, err);
    }
  }
});

// Register slash commands
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
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Check a user’s timeout status")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User").setRequired(true)
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

// Command handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand() || interaction.commandName !== "timeout") return;

  const member = interaction.member;
  const hasAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
  const hasAllowedRole = ALLOWED_ROLES.some((id) => member.roles.cache.has(id));

  if (!hasAdmin && !hasAllowedRole) {
    return interaction.reply({
      content: "🚫 You don’t have permission to use this command.",
      ephemeral: true,
    });
  }

  const sub = interaction.options.getSubcommand();
  const user = interaction.options.getUser("user");
  const targetId = user.id;
  const guildMember = await interaction.guild.members.fetch(targetId).catch(() => null);
  timeouts[targetId] = timeouts[targetId] || {};
  const now = Date.now();

  function format(ms) {
    if (!ms || ms <= 0) return "N/A";
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  switch (sub) {
    case "call": {
      const minutes = interaction.options.getInteger("minutes");
      timeouts[targetId].callUntil = now + minutes * 60 * 1000;
      saveData();
      if (guildMember?.voice?.channel) {
        await guildMember.voice.disconnect("Voice timeout applied.").catch(() => {});
      }
      return interaction.reply({
        content: `🔇 ${user.username} is voice-timed out for ${minutes} minutes.`,
        ephemeral: true,
      });
    }

    case "text": {
      const minutes = interaction.options.getInteger("minutes");
      timeouts[targetId].textUntil = now + minutes * 60 * 1000;
      saveData();
      return interaction.reply({
        content: `💬 ${user.username} is chat-timed out for ${minutes} minutes.`,
        ephemeral: true,
      });
    }

    case "remove": {
      delete timeouts[targetId];
      saveData();
      return interaction.reply({
        content: `✅ All timeouts removed for ${user.username}.`,
        ephemeral: true,
      });
    }

    case "cooldown": {
      const gap = interaction.options.getInteger("gap");
      const duration = interaction.options.getInteger("duration");
      timeouts[targetId].cooldownGap = gap;
      timeouts[targetId].cooldownUntil = now + duration * 60 * 1000;
      timeouts[targetId].lastMsg = null;
      saveData();
      return interaction.reply({
        content: `⌛ ${user.username} can only send 1 msg every ${gap}s for ${duration} minutes.`,
        ephemeral: true,
      });
    }

    case "status": {
      const data = timeouts[targetId];
      if (!data)
        return interaction.reply({
          content: `ℹ️ ${user.username} has no active timeouts or cooldowns.`,
          ephemeral: true,
        });

      const textLeft = data.textUntil ? data.textUntil - now : 0;
      const callLeft = data.callUntil ? data.callUntil - now : 0;
      const cooldownLeft = data.cooldownUntil ? data.cooldownUntil - now : 0;

      const msg = `📊 **${user.username}'s Timeout Status:**
🗣️ Call Timeout: ${callLeft > 0 ? format(callLeft) + " remaining" : "N/A"}
💬 Chat Timeout: ${textLeft > 0 ? format(textLeft) + " remaining" : "N/A"}
⌛ Chat Cooldown: ${
        cooldownLeft > 0
          ? `${data.cooldownGap}s gap for ${format(cooldownLeft)}`
          : "N/A"
      }`;

      return interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

client.once("ready", () => console.log(`🤖 Logged in as ${client.user.tag}`));
client.login(TOKEN);
