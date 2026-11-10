const { PermissionFlagsBits } = require("discord.js");
const { getGuild } = require("./storage");

function isAdministrator(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function hasCategory(member, category) {
  if (!member || !member.guild) return false;
  if (isAdministrator(member)) return true;

  const config = getGuild(member.guild.id);
  const roleId = config.roles[category];
  if (!roleId) return false;
  return member.roles.cache.has(roleId);
}

async function requireCategory(interaction, category) {
  const allowed = hasCategory(interaction.member, category);
  if (!allowed) {
    const config = getGuild(interaction.guildId);
    const roleId = config.roles[category];
    const roleText = roleId ? `<@&${roleId}>` : "No role has been configured yet.";
    await interaction.reply({
      content: `You don't have permission to use this command. Required role: ${roleText}`,
      ephemeral: true
    });
    return false;
  }
  return true;
}

module.exports = { isAdministrator, hasCategory, requireCategory };
