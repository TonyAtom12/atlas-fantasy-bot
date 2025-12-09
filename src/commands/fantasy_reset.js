const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Detectar liga por canal
function getLeagueFromChannel(name) {
  const n = name.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

// Paths por liga
function leagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
    lineupsPath:  path.join(base, "lineups.json"),
    scoresPath:   path.join(base, "scores.json"),
    marketPath:   path.join(base, "market.json"),
    tradesPath:   path.join(base, "trades.json"),
    playersPath:  path.join(base, "players.json") // ESTA VEZ SÍ se resetea
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fantasy_reset")
    .setDescription("🔥 Resetear liga al completo, incluidos jugadores")
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

    // --- RESET COMPLETO ---
    fs.writeFileSync(managersPath, JSON.stringify({}, null, 2));

    fs.writeFileSync(lineupsPath, JSON.stringify({
      lineups: {},
      currentWeek: 1
    }, null, 2));

    fs.writeFileSync(scoresPath, JSON.stringify({
      weeks: {},
      totalPoints: {}
    }, null, 2));

    fs.writeFileSync(marketPath, JSON.stringify({
      week: 1,
      playersOnAuction: []
    }, null, 2));

    fs.writeFileSync(tradesPath, JSON.stringify({
      offers: []
    }, null, 2));

    // 🔥 RESET REAL DE JUGADORES EN LA LIGA
    // Esto hace que los jugadores se clonen del globalPlayers.json cuando se use /joinfantasy
    fs.writeFileSync(playersPath, JSON.stringify({}, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0xff2222)
      .setTitle("🔥 FANTASY RESET COMPLETO")
      .addFields(
        { name: "Liga", value: `**${league}**`, inline: true },
        { name: "Jugadores", value: "🔄 Reiniciados a 0", inline: true },
        { name: "Managers - Puntos - Mercado - Trades", value: "🧹 Todo limpio" }
      )
      .setFooter({ text: "La liga está lista para una nueva temporada 🏁" });

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
