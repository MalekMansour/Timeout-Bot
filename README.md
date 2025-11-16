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
/timeout status @user

### 🔐 Permission System
Only the following users can execute `/timeout` commands:
- Server administrators  
- Members with **any** of the allowed roles (defined in `ALLOWED_ROLES`)  

---

### 🛠️ Slash Commands

The following subcommands are automatically registered:

Command	Description
/timeout call @user minutes:	Voice timeout
/timeout text @user minutes:	Chat timeout
/timeout cooldown @user gap: duration:	Slowmode
/timeout remove @user	Remove all punishments
/timeout status @user	View active timeouts

### 🔄 Data Persistence

Timeout data is saved in:

timeouts.json


It automatically updates every:

Message sent

Timeout creation

Timeout expiration

Cooldown checks

If the bot restarts, all active timeouts remain enforced.

### ▶️ Run the Bot
node index.js

### 🧠 Notes & Tips

The bot needs Manage Messages & Disconnect Members permissions.

The bot must be higher in the role list than any role it tries to check.

Cooldown checks are very lightweight safe for large servers.

All messages sent by the bot auto-delete after 5 seconds (spam-free).

### 📜 License

MIT License — free to use, modify, and share.
