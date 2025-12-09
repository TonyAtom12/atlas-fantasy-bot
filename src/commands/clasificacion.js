const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(name) {
  const n = name.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    scoresPath: path.join(base, "scores.json"),
    managersPath: path.join(base, "managers.json"),
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clasificacion")
    .setDescription("📊 Muestra la clasificación del Fantasy")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) {
      return interaction.reply({
        content: "❌ Ejecuta este comando en un canal de Fantasy",
        ephemeral: true,
      });
    }

    const { scoresPath, managersPath } = loadLeagueFiles(league);

    if (!fs.existsSync(scoresPath)) {
      return interaction.reply({
        content: "⚠️ Aún no hay puntuaciones registradas.",
        ephemeral: true,
      });
    }

    const scores = JSON.parse(fs.readFileSync(scoresPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));

    console.log(`📊 [CLASIFICACIÓN] Liga: ${league}`);

    const weeks = Object.keys(scores.weeks || {}).map(Number).sort((a, b) => a - b);
    const currentWeek = weeks[weeks.length - 1];

    if (!currentWeek) {
      return interaction.reply({
        content: "📭 No hay puntuaciones todavía.",
        ephemeral: true,
      });
    }

    const semanaData = scores.weeks[currentWeek] || {};
    const totalData = scores.totalPoints || {};

    const rankingSemana = Object.entries(semanaData)
      .map(([id, pts]) => ({ id, pts }))
      .sort((a, b) => b.pts - a.pts);

    const rankingTotal = Object.entries(totalData)
      .map(([id, pts]) => ({ id, pts }))
      .sort((a, b) => b.pts - a.pts);

    const format = (r, idx) =>
      `**${idx + 1}.** <@${r.id}> — **${r.pts}** pts`;

    const embed = new EmbedBuilder()
      .setColor(0x00A2FF)
      .setTitle(`🏆 Clasificación — ${league}`)
      .addFields(
        {
          name: `📊 Semana ${currentWeek}`,
          value: rankingSemana.map(format).join("\n") || "Sin puntos",
        },
        {
          name: "📈 Total Temporada",
          value: rankingTotal.map(format).join("\n") || "Sin datos",
        }
      )
      .setFooter({ text: "Actualizada con /calcular_puntos" });

    return interaction.reply({ embeds: [embed] });
  }
};
