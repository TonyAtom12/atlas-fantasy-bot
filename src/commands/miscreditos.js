const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(channelName) {
  if (channelName.toLowerCase().includes("fantasy-dmg-a")) return "DominguerosA";
  if (channelName.toLowerCase().includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("miscreditos")
    .setDescription("💳 Consulta tus créditos actuales de Fantasy"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "🚫 Este comando solo puede usarse en un canal de Fantasy (#fantasy-dmg-a o #fantasy-dmg-b).",
        ephemeral: true
      });
    }

    const managersPath = path.join(__dirname, "..", "data", "fantasy", league, "managers.json");
    if (!fs.existsSync(managersPath)) {
      return interaction.reply({
        content: "⚠️ No hay datos de esta liga aún.",
        ephemeral: true
      });
    }

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const manager = managers[userId];

    if (!manager) {
      return interaction.reply({
        content: "❌ No estás inscrito en esta liga. Usa `/joinfantasy`.",
        ephemeral: true
      });
    }

    const credits = manager.credits ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x00A8FF)
      .setTitle("💳 Créditos disponibles")
      .setDescription(
        `📍 Liga: **${league}**\n\n` +
        `Tienes actualmente **${credits} créditos**.\n\n🛒 Puedes pujar o fichar jugadores.`
      )
      .setFooter({ text: "Fantasy Domingueros — Economía en marcha 💸" });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
