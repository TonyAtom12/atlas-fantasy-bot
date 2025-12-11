const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
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
    managersPath: path.join(base, "managers.json"),
    playersFantasyPath: path.join(base, "players.json"),
    lineupsPath: path.join(base, "lineups.json"),
    scoresPath: path.join(base, "scores.json"),
  };
}

function loadScores(scoresPath) {
  if (!fs.existsSync(scoresPath)) {
    return { weeks: {}, diff: {}, details: {} };
  }

  const raw = fs.readFileSync(scoresPath, "utf8").trim();
  if (!raw) {
    return { weeks: {}, diff: {}, details: {} };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("❌ scores.json corrupto, recreando:", e.message);
    return { weeks: {}, diff: {}, details: {} };
  }

  if (!parsed.weeks || typeof parsed.weeks !== "object") parsed.weeks = {};
  if (!parsed.diff || typeof parsed.diff !== "object") parsed.diff = {};
  if (!parsed.details || typeof parsed.details !== "object") parsed.details = {};

  return parsed;
}

function sanitizeLineups(lineups) {
  if (!lineups || typeof lineups !== "object") {
    return { currentWeek: 1, lineups: {} };
  }

  if (!lineups.lineups || typeof lineups.lineups !== "object") {
    lineups.lineups = {};
  }

  for (const key of Object.keys(lineups)) {
    if (key === "lineups" || key === "currentWeek") continue;
    if (/^\d+$/.test(key)) {
      lineups.lineups[key] = lineups[key];
      delete lineups[key];
    }
  }

  return lineups;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("calcular_puntos")
    .setDescription("📊 Calcula los puntos semanales y genera detalles por jugador")
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

    // GLOBAL players.json
    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    if (!fs.existsSync(globalPlayersPath)) {
      return interaction.reply({
        content: "❌ No se encontró el players.json GLOBAL.",
        ephemeral: true
      });
    }
    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));

    const { managersPath, lineupsPath, scoresPath } = loadLeagueFiles(league);

    if (!fs.existsSync(managersPath) || !fs.existsSync(lineupsPath)) {
      return interaction.reply({
        content: "❌ Faltan managers o alineaciones para esta liga.",
        ephemeral: true
      });
    }

    const managers = JSON.parse(fs.readFileSync(managersPath));
    let lineups = JSON.parse(fs.readFileSync(lineupsPath));
    lineups = sanitizeLineups(lineups);

    let scores = loadScores(scoresPath);

    if (!scores.weeks[week]) scores.weeks[week] = {};
    if (!scores.diff[week]) scores.diff[week] = {};
    if (!scores.details[week]) scores.details[week] = {};

    // Obtiene diferencia de puntos globales entre semana y semana-1
    function getDiff(playerName) {
      const p = globalPlayers[playerName];
      if (!p || !Array.isArray(p.history)) return 0;

      const actual = p.history.find(h => h.week === week);
      const prev   = p.history.find(h => h.week === week - 1);

      const a = actual?.totalPoints ?? 0;
      const b = prev?.totalPoints ?? 0;

      return a - b;
    }

    function buildDetails(list, multiplier) {
      const detail = {};
      let subtotal = 0;

      for (const name of list) {
        const diff = getDiff(name);
        const pts = Math.round(diff * multiplier);
        detail[name] = pts;
        subtotal += pts;
      }

      return { detail, subtotal };
    }

    let processed = 0;

    for (const userId of Object.keys(managers)) {
      const lineup = lineups.lineups?.[userId];
      if (!lineup) continue;

      const starters = Array.isArray(lineup.starters) ? lineup.starters : [];
      const bench    = Array.isArray(lineup.bench)    ? lineup.bench    : [];

      const dStarters = buildDetails(starters, 1);
      const dBench = buildDetails(bench, 0.5);

      const finalPoints = dStarters.subtotal + dBench.subtotal;

      // Guardar totales semanales
      scores.weeks[week][userId] = finalPoints;

      // Diferencia respecto a semana previa
      const prevPoints = scores.weeks[week - 1]?.[userId] ?? 0;
      scores.diff[week][userId] = finalPoints - prevPoints;

      // Guardar DETALLES COMPLETOS
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

    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0x00ff44)
      .setTitle(`📊 Fantasy ${league} — Semana ${week}`)
      .setDescription("Puntos semanales calculados correctamente, con desglose por jugador.")
      .addFields({ name: "Managers procesados", value: `${processed}`, inline: true });

    return interaction.reply({ embeds: [embed] });
  }
};
