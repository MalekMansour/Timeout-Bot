# ⛔ Discord Timeout & Cooldown Bot

A powerful moderation bot that allows admins (or users with specific roles) to apply **voice timeouts**, **text timeouts**, and **message cooldowns**, all through a single `/timeout` slash command.

The bot also automatically enforces the restrictions in real-time:
- Deletes blocked messages  
- Disconnects users from voice when necessary  
- Tracks cooldowns per-user  
- Persists data automatically using `timeouts.json`

---

## ✨ Features

### 🔇 Voice Timeout  
Prevent a user from joining **any voice channel** for a set number of minutes.

### 💬 Chat Timeout  
Block a user from sending **any messages** for a chosen duration.

### ⌛ Chat Cooldown  
Limit a user to sending **one message every X seconds**, for a specified duration.

### 📊 Status Viewer  
Check any user’s active moderation timers using:  
