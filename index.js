import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TOKEN = "YOUR_BOT_TOKEN_HERE";
const ROLE_ID = "ROLE_ID_TO_LIMIT"; 
const LIMIT_SECONDS = 4 * 60 * 60; 

// Store user voice times (persisted daily)
let voiceData = {};
const DATA_FILE = "./voiceData.json";

// Load saved data if exists
if (fs.existsSync(DATA_FILE)) {
  voiceData = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Reset daily at midnight
function scheduleDailyReset() {
  const now = new Date();
  const millisUntilMidnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5) -
    now;
  setTimeout(() => {
    voiceData = {};
    fs.writeFileSync(DATA_FILE, JSON.stringify(voiceData));
    console.log("✅ Daily reset complete");
    scheduleDailyReset();
  }, millisUntilMidnight);
}
scheduleDailyReset();

// When user joins/leaves VC
client.on("voiceStateUpdate", async (oldState, newState) => {
  const user = newState.member || oldState.member;
  if (!user.roles.cache.has(ROLE_ID)) return;

  const userId = user.id;
  const now = Date.now();

  // User joins a VC
  if (!oldState.channelId && newState.channelId) {
    voiceData[userId] = voiceData[userId] || { total: 0, join: now, blocked: false };

    // Check if already blocked
    if (voiceData[userId].blocked) {
      try {
        await user.voice.disconnect("You reached your 4-hour limit today.");
      } catch {}
      return;
    }

    voiceData[userId].join = now;
  }

  // User leaves VC
  else if (oldState.channelId && !newState.channelId) {
    if (!voiceData[userId] || !voiceData[userId].join) return;

    const sessionTime = (now - voiceData[userId].join) / 1000; // seconds
    voiceData[userId].total += sessionTime;
    voiceData[userId].join = null;

    if (voiceData[userId].total >= LIMIT_SECONDS) {
      voiceData[userId].blocked = true;
      console.log(`${user.user.tag} reached daily VC limit.`);
    }
  }

  // Save data
  fs.writeFileSync(DATA_FILE, JSON.stringify(voiceData));
});

// If user tries to join again after limit reached
client.on("voiceStateUpdate", async (oldState, newState) => {
  const user = newState.member;
  if (!user || !user.roles.cache.has(ROLE_ID)) return;

  const data = voiceData[user.id];
  if (data && data.blocked && newState.channelId) {
    try {
      await user.voice.disconnect("You reached your 4-hour VC limit today.");
    } catch (err) {
      console.error("Failed to disconnect user:", err);
    }
  }
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
