# Yats Discord Bot

A Discord.js v14 bot starter focused on Yats staff tools, reports, bug tracking, announcements, and configurable role permissions.

## Requirements

- Node.js 20 or newer
- A Discord application and bot
- A Discord server where you can manage roles and invite apps

## 1. Create the Discord bot

1. Open https://discord.com/developers/applications
2. Create an application named **Yats Bot**.
3. Open **Bot** and create/reset the bot token.
4. Keep the token private. Never share it or commit it to Git.
5. Under **OAuth2 > URL Generator**, select scopes `bot` and `applications.commands`.
6. Give the bot these permissions:
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Manage Messages (for `/purge`)
   - Manage Channels (for `/lock` and `/unlock`)
7. Invite it to your server.

The bot does not need the privileged Message Content intent. It uses slash commands.

## 2. Configure the project

1. Install Node.js 20+.
2. Extract this ZIP.
3. Copy `.env.example` to a new file named `.env`.
4. Fill in `DISCORD_TOKEN` and `CLIENT_ID`.
5. For faster testing, put your server ID in `GUILD_ID`. Leave it blank to register commands globally.

## 3. Install and start

Open a terminal in the project folder and run:

```bash
npm install
npm run deploy
npm start
```

Keep the terminal/process running while you want the bot online. For a hosted bot, upload this project to a Node.js host and add the same environment variables in its settings. Do not upload your `.env` file.

## 4. Configure staff roles in Discord

First, make sure your own Discord account has the Administrator permission.

Use:

```text
/setrole category: Moderator role: @Cool Mod
/setrole category: Support role: @Support Team
/setrole category: Developer role: @Developers
/setrole category: Game Staff role: @Game Staff
```

These are category assignments, not newly-created Discord commands. The bot stores the selected role ID for that server. The role names can be anything. Use `/roles` to see the current configuration.

Only Discord members with Administrator permission can run `/setrole` and `/setlogchannel`. Discord administrators can also use all bot command categories. Other users must have the configured role for the category.

Set a private staff log channel:

```text
/setlogchannel channel: #staff-logs
```

## Commands and permissions

| Command | Access |
|---|---|
| `/setrole` | Discord Administrator |
| `/roles` | Everyone |
| `/setlogchannel` | Discord Administrator |
| `/warn`, `/warnings`, `/clearwarnings` | Moderator |
| `/reports`, `/resolve` | Support or Moderator |
| `/report` | Everyone |
| `/announce` | Game Staff |
| `/bugs`, `/fixbug` | Game Staff or Developer |
| `/bug` | Everyone |
| `/purge` | Discord Manage Messages permission |
| `/lock`, `/unlock` | Discord Manage Channels permission |

## Important notes

- The bot stores role IDs, warnings, reports, bug reports, and settings in `data/guilds.json`. Back up this file.
- Data is stored separately for each Discord server.
- `/warn` records a warning only. It does not automatically ban, kick, or timeout anyone.
- `/report` and `/bug` submissions are also sent to the configured staff log channel, if one is set.
- Game commands such as player lookup, in-game bans, live player counts, and game broadcasts need a secure Yats backend/API. They are not connected to the game by this starter project.
- Give the bot role a position above roles it needs to manage, and only grant it the Discord permissions it actually needs.
- `/lock` changes the current channel's `@everyone` Send Messages overwrite. `/unlock` clears that specific override.
- For a larger production bot, move JSON storage to a database such as PostgreSQL or SQLite and add backups/monitoring.

## Troubleshooting

- If slash commands do not appear, confirm the app was invited with both `bot` and `applications.commands` scopes, then run `npm run deploy` again.
- Guild commands appear much faster than global commands. Set `GUILD_ID` during development.
- If a command says the bot lacks permissions, check the bot's role position and channel permissions.
- Never paste your bot token into chat, screenshots, or source control. If it is exposed, reset it in the Discord Developer Portal.
