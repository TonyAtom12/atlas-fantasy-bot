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
    .setName("status")
    .setDescription("Consulta tu equipo y créditos en tu liga actual")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando dentro de un canal de fantasy (#fantasy-dmg-a o #fantasy-dmg-b).",
        ephemeral: true
      });
    }

    const managersPath = path.join(__dirname, "..", "data", "fantasy", league, "managers.json");
    if (!fs.existsSync(managersPath)) {
      return interaction.reply({
        content: "⚠️ No se encontraron datos de managers en esta liga.",
        ephemeral: true
      });
    }

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const userId = interaction.user.id;
    const userData = managers[userId];

    if (!userData) {
      return interaction.reply({
        content: "❌ No estás inscrito en el Fantasy. Usa `/joinfantasy` para unirte.",
        ephemeral: true
      });
    }

    const teamArray = userData.team ?? [];
    const teamDisplay =
      teamArray.length > 0
        ? teamArray.map(p => `• ${p}`).join("\n")
        : "— Aún no tienes jugadores asignados —";

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle(`📊 Estado del Fantasy — ${interaction.user.username}`)
      .setDescription(`📌 Liga: **${league}**`)
      .addFields(
        { name: "💰 Créditos disponibles", value: `${userData.credits}`, inline: true },
        { name: "👥 Plantilla", value: teamDisplay, inline: false }
      )
      .setFooter({ text: "Fantasy Domingueros 🏎️" });

    return interaction.reply({ embeds: [embed] });
  }
};
