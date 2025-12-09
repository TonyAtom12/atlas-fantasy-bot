const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Detectar liga según canal
function getLeagueFromChannel(channelName) {
  if (channelName.toLowerCase().includes("fantasy-dmg-a")) return "DominguerosA";
  if (channelName.toLowerCase().includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    leaguePlayersPath: path.join(base, "players.json"),
    marketPath: path.join(base, "market.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("subirmercado")
    .setDescription("Sube 10 jugadores libres al mercado aleatoriamente (Solo Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "❌ Este comando solo puede usarse en canales de Fantasy (A/B)",
        ephemeral: true
      });
    }

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy/players.json");
    const { leaguePlayersPath, marketPath } = loadLeagueFiles(league);

    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));
    const leaguePlayers = JSON.parse(fs.readFileSync(leaguePlayersPath));
    const market = JSON.parse(fs.readFileSync(marketPath));

    const libres = Object.values(globalPlayers).filter(p =>
      !leaguePlayers[p.playerName] || 
      !leaguePlayers[p.playerName].owner
    );

    if (libres.length === 0) {
      return interaction.reply("📭 No quedan jugadores libres disponibles en esta liga.");
    }

    const aleatorios = libres
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(10, libres.length));

    if (!market.playersOnAuction) market.playersOnAuction = [];
    if (!market.bids) market.bids = {};

    for (const p of aleatorios) {
      market.playersOnAuction.push(p.playerName);
      market.bids[p.playerName] = [];
    }

    fs.writeFileSync(marketPath, JSON.stringify(market, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0xffd000)
      .setTitle(`🛒 Mercado Semanal — ${league}`)
      .setDescription(
        aleatorios.map(p => `• **${p.playerName}**`).join("\n")
      )
      .setFooter({ text: "A pujar en privado 😎" });

    interaction.reply({ embeds: [embed] });
  }
};
