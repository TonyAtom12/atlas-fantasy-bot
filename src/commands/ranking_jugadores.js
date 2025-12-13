const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// =======================================
// 🎯 Detectar liga
// =======================================
function getLeagueFromChannel(name) {
  const n = name.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function leagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    scoresPath: path.join(base, "scores.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ranking_jugadores")
    .setDescription("📈 Ranking de jugadores por DELTA semanal + Top subidas")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando en un canal de Fantasy.",
        ephemeral: true
      });
    }

    const { scoresPath } = leagueFiles(league);

    if (!fs.existsSync(scoresPath)) {
      return interaction.reply({
        content: "⚠️ No hay puntuaciones registradas.",
        ephemeral: true
      });
    }

    const scores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));

    const weeks = Object.keys(scores.details || {})
      .map(Number)
      .sort((a, b) => a - b);

    if (weeks.length === 0) {
      return interaction.reply({
        content: "📭 No hay semanas con detalles registrados.",
        ephemeral: true
      });
    }

    const currentWeek = weeks.at(-1);
    const detailsWeek = scores.details[currentWeek];

    if (!detailsWeek || Object.keys(detailsWeek).length === 0) {
      return interaction.reply({
        content: "📭 No hay datos de jugadores esta semana.",
        ephemeral: true
      });
    }

    const rankingPlayers = [];

    // =======================================
    // 🔢 Recolectar puntos por jugador
    // =======================================
    for (const [userId, detail] of Object.entries(detailsWeek)) {
      const starters = detail.starters || {};
      const bench    = detail.bench || {};

      for (const [name, pts] of Object.entries(starters)) {
        rankingPlayers.push({
          name,
          pts,
          role: "T"
        });
      }

      for (const [name, pts] of Object.entries(bench)) {
        rankingPlayers.push({
          name,
          pts,
          role: "S"
        });
      }
    }

    // ordenar por puntos (DELTA semanal)
    rankingPlayers.sort((a, b) => b.pts - a.pts);

    // =======================================
    // 📊 Ranking texto
    // =======================================
    let rankingText;

    if (rankingPlayers.length === 0) {
      rankingText = "📭 No hubo jugadores con puntos esta semana.";
    } else {
      rankingText = rankingPlayers
        .slice(0, 20)
        .map((p, i) => {
          const icon =
            p.pts > 0 ? "📈" :
            p.pts < 0 ? "📉" : "➡️";

          return `**${i + 1}.** ${icon} **${p.name}** — ${p.pts >= 0 ? "+" : ""}${p.pts} pts`;
        })
        .join("\n");
    }

    // =======================================
    // 🚀 Top Subidas
    // =======================================
    const topSubidas = rankingPlayers
      .filter(p => p.pts > 0)
      .slice(0, 5);

    const subidasText = topSubidas.length === 0
      ? "—"
      : topSubidas
          .map((p, i) =>
            `**${i + 1}.** 🚀 **${p.name}** +${p.pts} pts`
          )
          .join("\n");

    // =======================================
    // 📣 EMBED
    // =======================================
    const embed = new EmbedBuilder()
      .setColor(0x55A0FF)
      .setTitle(`📈 Ranking de Jugadores — Semana ${currentWeek}`)
      .setDescription(rankingText)
      .addFields({
        name: "🚀 Top Subidas de la Semana",
        value: subidasText
      })
      .setFooter({
        text: "Datos obtenidos de scores.json (delta semanal real)"
      });

    return interaction.reply({ embeds: [embed] });
  }
};
