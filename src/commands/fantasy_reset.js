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
    managersPath: path.join(base, "managers.json"),
    lineupsPath:  path.join(base, "lineups.json"),
    scoresPath:   path.join(base, "scores.json"),
    marketPath:   path.join(base, "market.json"),
    tradesPath:   path.join(base, "trades.json"),
    playersPath:  path.join(base, "players.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fantasy_reset")
    .setDescription("🔥 Reset total de liga + reset de estadísticas globales")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando en un canal de liga Fantasy",
        ephemeral: true
      });
    }

    const { managersPath, lineupsPath, scoresPath, marketPath, tradesPath, playersPath } =
      leagueFiles(league);

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");

    // Reset managers, lineups, scores, market, trades
    fs.writeFileSync(managersPath, JSON.stringify({}, null, 2));
    fs.writeFileSync(lineupsPath, JSON.stringify({ lineups: {}, currentWeek: 1 }, null, 2));
    fs.writeFileSync(
      scoresPath,
      JSON.stringify(
        {
          weeks: {},
          diff: {},
          details: {},
          totalPoints: {}
        },
        null,
        2
      )
    );
        fs.writeFileSync(marketPath, JSON.stringify({ week: 1, playersOnAuction: [] }, null, 2));
    fs.writeFileSync(tradesPath, JSON.stringify({ offers: [] }, null, 2));

    // Reset jugadores de liga
    fs.writeFileSync(playersPath, JSON.stringify({}, null, 2));

    // Reset estadística global
    if (fs.existsSync(globalPlayersPath)) {
      const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));

      for (const p of Object.values(globalPlayers)) {
        p.totalPoints = 0;
        p.history = [
          { week: 0, totalPoints: 0 }
        ];
      }

      fs.writeFileSync(globalPlayersPath, JSON.stringify(globalPlayers, null, 2));
    }

    const embed = new EmbedBuilder()
      .setColor(0xff2222)
      .setTitle("🔥 RESET GLOBAL + LIGA COMPLETO")
      .addFields(
        { name: "Liga", value: league },
        { name: "Jugadores Globales", value: "🔄 totalPoints reseteados + semana 0" },
        { name: "Datos Liga", value: "🧹 managers, puntuaciones, mercado y plantillas limpiados" }
      )
      .setFooter({ text: "Todo listo para comenzar desde cero 🏁" });

    return interaction.reply({ embeds: [embed] });
  }
};
