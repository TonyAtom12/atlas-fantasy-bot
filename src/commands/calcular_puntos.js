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
  if (!fs.existsSync(scoresPath))
    return { weeks: {}, diff: {} };

  const raw = fs.readFileSync(scoresPath, "utf8").trim();
  if (!raw) return { weeks: {}, diff: {} };

  return JSON.parse(raw);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("calcular_puntos")
    .setDescription("📊 Calcula los puntos fantasy semanales basados en las diferencias del global")
    .addIntegerOption(opt =>
      opt.setName("semana")
        .setDescription("Número de semana")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league)
      return interaction.reply({ content: "❌ Usa este comando en un canal de Fantasy.", ephemeral: true });

    const week = interaction.options.getInteger("semana");
    
    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));

    const { managersPath, lineupsPath, scoresPath } = loadLeagueFiles(league);

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const lineups = JSON.parse(fs.readFileSync(lineupsPath));
    const scores = loadScores(scoresPath);

    scores.weeks[week] = scores.weeks[week] ?? {};
    scores.diff[week] = scores.diff[week] ?? {};

    for (const userId in managers) {
      const lineup = lineups[userId] || lineups.lineups?.[userId];
      if (!lineup) continue;

      const starters = lineup.starters || [];
      const bench = lineup.bench || [];

      let total = 0;

      function getDiff(playerName) {
        const p = globalPlayers[playerName];
        if (!p || !p.history) return 0;

        const actual = p.history.find(h => h.week === week);
        const prev = p.history.find(h => h.week === week - 1);

        const a = actual?.totalPoints ?? 0;
        const b = prev?.totalPoints ?? 0;

        return a - b;
      }

      // titulares
      starters.forEach(p => {
        total += getDiff(p);
      });

      // suplentes
      bench.forEach(p => {
        total += getDiff(p) * 0.5;
      });

      total = Math.round(total);

      scores.weeks[week][userId] = total;

      // diferencia respecto a semana anterior de manager
      const prev = scores.weeks[week - 1]?.[userId] ?? 0;
      scores.diff[week][userId] = total - prev;
    }

    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0x00ff44)
      .setTitle(`📊 Fantasy ${league} — Semana ${week}`)
      .setDescription(`Puntos semanales calculados correctamente mediante diferencias GLOBAL.`)
      .addFields({ name: "Managers procesados", value: `${Object.keys(scores.weeks[week]).length}` });

    return interaction.reply({ embeds: [embed] });
  }
};
