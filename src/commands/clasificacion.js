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
    .setDescription("📊 Muestra la clasificación del Fantasy con detalles")
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

    console.log(`📊 [CLASIFICACIÓN DETALLADA] Liga: ${league}`);

    const weeks = Object.keys(scores.weeks || {})
      .map(Number)
      .sort((a, b) => a - b);

    const currentWeek = weeks[weeks.length - 1];
    const previousWeek = weeks[weeks.length - 2];

    if (!currentWeek) {
      return interaction.reply({
        content: "📭 No hay puntuaciones todavía.",
        ephemeral: true,
      });
    }

    const semanaData = scores.weeks[currentWeek] || {};
    const diffData   = scores.diff[currentWeek] || {};
    const details    = scores.details?.[currentWeek] || {};

    // Total de temporada: si no existe, lo recalculamos
    let totalData = scores.totalPoints || {};

    if (!scores.totalPoints) {
      totalData = {};
      for (const w of weeks) {
        for (const [id, pts] of Object.entries(scores.weeks[w])) {
          if (!totalData[id]) totalData[id] = 0;
          totalData[id] += pts;
        }
      }
      scores.totalPoints = totalData;
      fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
    }

    // Ranking semanal
    const rankingSemana = Object.entries(semanaData)
      .map(([id, pts]) => ({ id, pts }))
      .sort((a, b) => b.pts - a.pts);

    // Ranking total
    const rankingTotal = Object.entries(totalData)
      .map(([id, pts]) => ({ id, pts }))
      .sort((a, b) => b.pts - a.pts);

    // Posición en el ranking total
    function positionTotal(id) {
      return rankingTotal.findIndex(x => x.id === id) + 1;
    }

    // Movimiento respecto a la semana previa (si existe)
    function movement(id) {
      if (!previousWeek) return "➖";
      const prevRank = Object.entries(scores.weeks[previousWeek] || {})
        .map(([pid, ppts]) => ({ id: pid, pts: ppts }))
        .sort((a, b) => b.pts - a.pts)
        .findIndex(x => x.id === id) + 1;

      const nowRank = rankingSemana.findIndex(x => x.id === id) + 1;

      const diff = prevRank - nowRank;
      if (diff > 0) return `⬆️ +${diff}`;
      if (diff < 0) return `⬇️ ${diff}`;
      return "➖";
    }

    // MVP y peor jugador del equipo
    function getMVP(detailObj) {
      const entries = Object.entries({
        ...detailObj.starters,
        ...detailObj.bench
      });

      if (!entries.length) return "—";

      const [name, pts] = entries.sort((a, b) => b[1] - a[1])[0];
      return `${name} (${pts > 0 ? "+" : ""}${pts})`;
    }

    function getWorst(detailObj) {
      const entries = Object.entries({
        ...detailObj.starters,
        ...detailObj.bench
      });

      if (!entries.length) return "—";

      const [name, pts] = entries.sort((a, b) => a[1] - b[1])[0];
      return `${name} (${pts > 0 ? "+" : ""}${pts})`;
    }

    // Formato de línea para ranking semanal
    function formatSemana(r, idx) {
      const d = details[r.id];
      const diff = diffData[r.id] ?? 0;

      const mvp = d ? getMVP(d) : "—";
      const worst = d ? getWorst(d) : "—";

      return `**${idx + 1}.** <@${r.id}> — **${r.pts} pts** (${diff >= 0 ? "+" : ""}${diff})
${movement(r.id)}  |  ⭐ MVP: ${mvp}  |  ❌ Peor: ${worst}`;
    }

    // Formato para ranking total
    function formatTotal(r, idx) {
      return `**${idx + 1}.** <@${r.id}> — **${r.pts} pts**`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00A2FF)
      .setTitle(`🏆 Clasificación — ${league}`)
      .addFields(
        {
          name: `📊 Semana ${currentWeek}`,
          value: rankingSemana.map(formatSemana).join("\n\n") || "Sin puntos",
        },
        {
          name: "📈 Total Temporada",
          value: rankingTotal.map(formatTotal).join("\n") || "Sin datos",
        }
      )
      .setFooter({ text: "Actualizada con /calcular_puntos" });

    return interaction.reply({ embeds: [embed] });
  }
};
