const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(channelName) {
  if (channelName.toLowerCase().includes("fantasy-dmg-a")) return "DominguerosA";
  if (channelName.toLowerCase().includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
    playersFantasyPath: path.join(base, "players.json"),
    marketPath: path.join(base, "market.json"),
    playersGlobalPath: path.join(__dirname, "..", "data", "fantasy", "players.json"),
    lineupsPath: path.join(base, "lineups.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cerrarmercado")
    .setDescription("📉 Cierra el mercado y adjudica jugadores (solo admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({ content: "❌ Usa este comando en un canal de Fantasy.", ephemeral: true });
    }

    const {
      managersPath,
      playersFantasyPath,
      marketPath,
      playersGlobalPath,
      lineupsPath
    } = loadLeagueFiles(league);

    const market = JSON.parse(fs.readFileSync(marketPath));
    const playersFantasy = JSON.parse(fs.readFileSync(playersFantasyPath));
    const playersGlobal = JSON.parse(fs.readFileSync(playersGlobalPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const lineups = fs.existsSync(lineupsPath)
      ? JSON.parse(fs.readFileSync(lineupsPath))
      : { currentWeek: market.week ?? 1, lineups: {} };

    const results = [];
    const playersOnAuction = [...market.playersOnAuction];

    for (const playerName of playersOnAuction) {
      const bidList = market.bids?.[playerName] ?? [];
      const playerGlobal = playersGlobal[playerName];
      const playerFantasy = playersFantasy[playerName] ?? null;

      if (!playerGlobal) {
        results.push(`⚠️ **${playerName}** → ERROR: No está en el global`);
        continue;
      }

      if (!bidList.length) {
        results.push(`😕 **${playerName}** → Libre sin pujas`);
        market.playersOnAuction = market.playersOnAuction.filter(p => p !== playerName);
        delete market.bids[playerName];
        continue;
      }

      bidList.sort((a, b) => b.amount !== a.amount ? b.amount - a.amount : (a.timestamp || 0) - (b.timestamp || 0));

      const { userId, amount } = bidList[0];
      const manager = managers[userId];

      if (!manager || manager.credits < amount) {
        results.push(`🚫 **${playerName}** → Puja anulada: créditos insuficientes`);
        delete market.bids[playerName];
        continue;
      }

      if ((manager.team?.length ?? 0) >= 10) {
        results.push(`🚫 **${playerName}** → Plantilla llena (${manager.username})`);
        delete market.bids[playerName];
        continue;
      }

      const player = structuredClone(playerFantasy ?? playerGlobal);
      player.owner = userId;
      player.status = "drafted";
      playersFantasy[playerName] = player;

      // Actualizar economía y plantilla del manager
      manager.credits -= amount;
      manager.team.push(playerName);

      // Añadir a banquillo automáticamente
      if (!lineups.lineups[userId]) {
        lineups.lineups[userId] = {
          week: market.week ?? 1,
          starters: [],
          bench: []
        };
      }

      if (!lineups.lineups[userId].starters.includes(playerName) &&
          !lineups.lineups[userId].bench.includes(playerName)) {
        lineups.lineups[userId].bench.push(playerName);
      }

      results.push(`🎯 **${playerName}** → ${manager.username} por **${amount}** créditos`);

      delete market.bids[playerName];
      market.playersOnAuction = market.playersOnAuction.filter(p => p !== playerName);
    }

    // Avanzar semana SOLO de esta liga
    market.week = (market.week ?? 1) + 1;
    market.bids = {};

    lineups.currentWeek = market.week;

    fs.writeFileSync(playersFantasyPath, JSON.stringify(playersFantasy, null, 2));
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(marketPath, JSON.stringify(market, null, 2));
    fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0x0077ff)
      .setTitle(`🏁 Mercado cerrado — ${league}`)
      .setDescription(results.join("\n") || "🧹 Sin movimientos")
      .setFooter({ text: `Semana ${market.week - 1} finalizada correctamente` });

    return interaction.reply({ embeds: [embed] });
  }
};
