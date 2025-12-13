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
function getLeagueFromChannel(channelName) {
  const n = channelName.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

// =======================================
// 📂 Rutas por liga
// =======================================
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
    .setDescription("Sube 10 jugadores libres al mercado (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "❌ Este comando solo puede usarse en canales de Fantasy (A/B)",
        ephemeral: true
      });
    }

    const globalPlayersPath = path.join(
      __dirname,
      "..",
      "data",
      "fantasy",
      "players.json"
    );

    const { leaguePlayersPath, marketPath } = loadLeagueFiles(league);

    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));
    const leaguePlayers = JSON.parse(fs.readFileSync(leaguePlayersPath));
    const market = JSON.parse(fs.readFileSync(marketPath));

    market.playersOnAuction ??= [];
    market.bids ??= {};
    market.week ??= 1;

    // =======================================
    // 🧍‍♂️ Jugadores libres
    // =======================================
    const libres = Object.values(globalPlayers).filter(p =>
      !leaguePlayers[p.playerName] || !leaguePlayers[p.playerName].owner
    );

    if (libres.length === 0) {
      return interaction.reply("📭 No quedan jugadores libres disponibles.");
    }

    const seleccionados = [];

    // =======================================
    // ⭐ BLACK ASTA — SOLO B + SEMANA 1
    // =======================================
    const forzarBlackAsta =
      league === "DominguerosB" &&
      market.week === 1;

    if (forzarBlackAsta) {
      const blackAsta = libres.find(p => p.playerName === "Black Asta");

      if (
        blackAsta &&
        !market.playersOnAuction.includes("Black Asta")
      ) {
        seleccionados.push(blackAsta);
      }
    }

    // =======================================
    // 🎲 Resto aleatorios hasta 10
    // =======================================
    const restantes = libres
      .filter(p => !seleccionados.some(s => s.playerName === p.playerName))
      .sort(() => Math.random() - 0.5)
      .slice(0, 10 - seleccionados.length);

    seleccionados.push(...restantes);

    // =======================================
    // 🛒 Añadir al mercado
    // =======================================
    for (const p of seleccionados) {
      if (!market.playersOnAuction.includes(p.playerName)) {
        market.playersOnAuction.push(p.playerName);
        market.bids[p.playerName] = [];
      }
    }

    fs.writeFileSync(marketPath, JSON.stringify(market, null, 2));

    // =======================================
    // 📣 EMBED
    // =======================================
    const listado = seleccionados
      .map(p => `• **${p.playerName}** — ${p.team} (Div ${p.division})`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xffd000)
      .setTitle(`🛒 Mercado Semanal — ${league}`)
      .setDescription(listado)
      .setFooter({
        text:
          league === "DominguerosB" && market.week === 1
            ? "Semana 1 en Liga B: Black Asta ha sido liberado 😈"
            : "A pujar en privado 😎"
      });

    return interaction.reply({ embeds: [embed] });
  }
};
