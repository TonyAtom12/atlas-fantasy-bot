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

function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
    lineupsPath:  path.join(base, "lineups.json"),
    scoresPath:   path.join(base, "scores.json"),
  };
}

function loadScores(scoresPath) {
  if (!fs.existsSync(scoresPath)) {
    return { weeks: {}, diff: {}, details: {} };
  }

  const parsed = JSON.parse(fs.readFileSync(scoresPath, "utf8"));
  parsed.weeks   ??= {};
  parsed.diff    ??= {};
  parsed.details ??= {};
  return parsed;
}

function sanitizeLineups(lineups) {
  lineups.lineups ??= {};
  return lineups;
}

// =======================================
// 🏆 Premios
// =======================================
const PRIZES = [100, 80, 60, 40, 20];

// =======================================
// 📊 COMANDO
// =======================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("calcular_puntos")
    .setDescription("📊 Calcula puntos semanales y reparte créditos")
    .addIntegerOption(opt =>
      opt.setName("semana")
        .setDescription("Número de semana")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando en un canal de Fantasy.",
        ephemeral: true
      });
    }

    const week = interaction.options.getInteger("semana");
    const prevWeek = week - 1;

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));

    const { managersPath, lineupsPath, scoresPath } = loadLeagueFiles(league);

    const managers = JSON.parse(fs.readFileSync(managersPath));
    let lineups = JSON.parse(fs.readFileSync(lineupsPath));
    lineups = sanitizeLineups(lineups);
    const scores = loadScores(scoresPath);

    scores.weeks[week]   ??= {};
    scores.diff[week]    ??= {};
    scores.details[week] ??= {};

    // =======================================
    // 🔢 Helpers
    // =======================================
    function getDiff(playerName) {
      const p = globalPlayers[playerName];
      if (!p?.history) return 0;

      const actual = p.history.find(h => h.week === week)?.totalPoints ?? 0;
      const prev   = p.history.find(h => h.week === prevWeek)?.totalPoints ?? 0;
      return actual - prev;
    }

    function buildDetails(list, multiplier) {
      const detail = {};
      let subtotal = 0;

      for (const name of list) {
        const pts = Math.round(getDiff(name) * multiplier);
        detail[name] = pts;
        subtotal += pts;
      }

      return { detail, subtotal };
    }

    // =======================================
    // 🧮 Cálculo
    // =======================================
    let processed = 0;

    for (const userId of Object.keys(managers)) {
      const lineup = lineups.lineups[userId];
      if (!lineup) continue;

      const starters = lineup.starters ?? [];
      const bench    = lineup.bench ?? [];

      const dStarters = buildDetails(starters, 1);
      const dBench    = buildDetails(bench, 0.5);

      const finalPoints = dStarters.subtotal + dBench.subtotal;

      scores.weeks[week][userId] = finalPoints;

      const prevPoints = scores.weeks[prevWeek]?.[userId] ?? 0;
      scores.diff[week][userId] = finalPoints - prevPoints;

      scores.details[week][userId] = {
        starters: dStarters.detail,
        bench: dBench.detail,
        totals: {
          starters: dStarters.subtotal,
          bench: dBench.subtotal,
          final: finalPoints
        }
      };

      processed++;
    }

    // =======================================
    // 🏆 Ranking + créditos
    // =======================================
    const ranking = Object.entries(scores.weeks[week])
      .map(([userId, points]) => ({ userId, points }))
      .sort((a, b) => b.points - a.points);

    const prizeText = [];

    ranking.forEach((r, index) => {
      const prize = PRIZES[index] ?? 0;
      if (!managers[r.userId]) return;

      const before = managers[r.userId].credits ?? 0;
      const after  = before + prize;

      managers[r.userId].credits = after;

      prizeText.push(
        `**${index + 1}º** <@${r.userId}> — ${r.points} pts → 💰 ${before} → ${after} (+${prize})`
      );
    });

    // =======================================
    // 💾 Guardar
    // =======================================
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));

    // =======================================
    // 📣 EMBED
    // =======================================
    const embed = new EmbedBuilder()
      .setColor(0x00ff44)
      .setTitle(`📊 Fantasy ${league} — Semana ${week}`)
      .setDescription("Puntos calculados, deltas registrados y créditos repartidos.")
      .addFields(
        { name: "Managers procesados", value: `${processed}`, inline: true },
        { name: "🏆 Clasificación y créditos", value: prizeText.join("\n") || "Sin datos" }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
