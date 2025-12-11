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
  
  function leagueFiles(league) {
    const base = path.join(__dirname, "..", "data", "fantasy", league);
    return {
      scoresPath:  path.join(base, "scores.json"),
      managersPath: path.join(base, "managers.json"),
      playersPath:  path.join(base, "players.json")
    };
  }
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("ranking_jugadores")
      .setDescription("📈 Muestra el ranking detallado de jugadores en la semana actual")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
    async execute(interaction) {
      const league = getLeagueFromChannel(interaction.channel.name);
      if (!league) {
        return interaction.reply({
          content: "❌ Usa este comando en un canal de Fantasy.",
          ephemeral: true
        });
      }
  
      const { scoresPath, managersPath, playersPath } = leagueFiles(league);
  
      if (!fs.existsSync(scoresPath)) {
        return interaction.reply({
          content: "⚠️ Aún no hay puntuaciones registradas.",
          ephemeral: true
        });
      }
  
      const scores = JSON.parse(fs.readFileSync(scoresPath));
      const players = JSON.parse(fs.readFileSync(playersPath));
      const managers = JSON.parse(fs.readFileSync(managersPath));
  
      const weeks = Object.keys(scores.weeks || {}).map(Number).sort((a, b) => a - b);
      const currentWeek = weeks[weeks.length - 1];
  
      if (!currentWeek) {
        return interaction.reply({
          content: "📭 Todavía no hay semanas calculadas.",
          ephemeral: true
        });
      }
  
      const detailsWeek = scores.details?.[currentWeek];
      if (!detailsWeek) {
        return interaction.reply({
          content: "⚠️ No existen detalles registrados para esta semana.",
          ephemeral: true
        });
      }
  
      const rankingPlayers = [];
  
      for (const [userId, detail] of Object.entries(detailsWeek)) {
        const starters = detail.starters || {};
        const bench    = detail.bench || {};
  
        for (const [name, pts] of Object.entries(starters)) {
          rankingPlayers.push({
            name,
            pts,
            owner: userId,
            role: "T",
            team: players[name]?.team || "—"
          });
        }
  
        for (const [name, pts] of Object.entries(bench)) {
          rankingPlayers.push({
            name,
            pts,
            owner: userId,
            role: "S",
            team: players[name]?.team || "—"
          });
        }
      }
  
      // ordenar por puntos (desc)
      rankingPlayers.sort((a, b) => b.pts - a.pts);
  
      const lines = rankingPlayers
        .map((p, i) =>
          `**${i + 1}.** ${p.role === "T" ? "🔵" : "🟡"} **${p.name}** — **${p.pts} pts**  
  👤 Dueño: <@${p.owner}> | 🏀 Equipo: ${p.team}`
        )
        .join("\n\n");
  
      const embed = new EmbedBuilder()
        .setColor(0x55A0FF)
        .setTitle(`📈 Ranking de Jugadores — Semana ${currentWeek}`)
        .setDescription(lines)
        .setFooter({ text: "Basado en los detalles generados por /calcular_puntos" });
  
      return interaction.reply({ embeds: [embed] });
    }
  };
  