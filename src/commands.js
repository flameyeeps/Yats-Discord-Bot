const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("Assign a Discord role to a Yats bot permission category (Administrator only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("category").setDescription("Which command category should this role control?")
      .setRequired(true).addChoices(
        { name: "Moderator", value: "moderator" },
        { name: "Support", value: "support" },
        { name: "Developer", value: "developer" },
        { name: "Game Staff", value: "game_staff" }
      ))
    .addRoleOption(o => o.setName("role").setDescription("The Discord role to assign").setRequired(true)),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Show the roles currently assigned to Yats bot permission categories."),

  new SlashCommandBuilder()
    .setName("setlogchannel")
    .setDescription("Choose where Yats bot staff logs and reports are sent (Administrator only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName("channel").setDescription("Staff log channel")
      .addChannelTypes(ChannelType.GuildText).setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member (Moderator).")
    .addUserOption(o => o.setName("member").setDescription("Member to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for the warning").setRequired(true).setMaxLength(800)),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a member's warnings (Moderator).")
    .addUserOption(o => o.setName("member").setDescription("Member to check").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear a member's warnings (Moderator).")
    .addUserOption(o => o.setName("member").setDescription("Member whose warnings should be cleared").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Why are the warnings being cleared?").setRequired(true).setMaxLength(500)),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Send a report to the Yats staff team.")
    .addUserOption(o => o.setName("member").setDescription("Member being reported").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("What happened?").setRequired(true).setMaxLength(1000)),

  new SlashCommandBuilder()
    .setName("reports")
    .setDescription("View unresolved member reports (Support or Moderator)."),

  new SlashCommandBuilder()
    .setName("resolve")
    .setDescription("Mark a report as resolved (Support or Moderator).")
    .addIntegerOption(o => o.setName("id").setDescription("Report ID").setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName("note").setDescription("Resolution note").setRequired(true).setMaxLength(500)),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post an official Yats announcement (Game Staff).")
    .addChannelOption(o => o.setName("channel").setDescription("Where to post").addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Announcement text").setRequired(true).setMaxLength(1900)),

  new SlashCommandBuilder()
    .setName("bug")
    .setDescription("Submit a Yats game bug report.")
    .addStringOption(o => o.setName("description").setDescription("Describe the bug and how it happened").setRequired(true).setMaxLength(1200)),

  new SlashCommandBuilder()
    .setName("bugs")
    .setDescription("View recent Yats bug reports (Game Staff or Developer)."),

  new SlashCommandBuilder()
    .setName("fixbug")
    .setDescription("Mark a bug report as fixed (Game Staff or Developer).")
    .addIntegerOption(o => o.setName("id").setDescription("Bug report ID").setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName("note").setDescription("What fixed it?").setRequired(true).setMaxLength(500)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete up to 100 recent messages (Administrator).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages to delete (1–100)").setRequired(true).setMinValue(1).setMaxValue(100)),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Stop @everyone from sending messages in this channel (Administrator).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Remove the bot's @everyone send-message restriction in this channel (Administrator).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
].map(command => command.toJSON());

module.exports = commands;
