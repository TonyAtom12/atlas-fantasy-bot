const {
  SlashCommandBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Detecta liga por canal
function getLeagueFromChannel(channelName) {
  if (channelName.toLowerCase().includes("fantasy-dmg-a")) return "DominguerosA";
  if (channelName.toLowerCase().includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

// Rutas por liga
function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
    playersPath: path.join(base, "players.json"),
    marketPath: path.join(base, "market.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pujar")
    .setDescription("🎯 Pujar en secreto por un jugador del mercado")
    .addStringOption(opt =>
      opt.setName("jugador")
        .setDescription("Jugador en subasta")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(opt =>
      opt.setName("cantidad")
        .setDescription("Créditos ofrecidos")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const league = getLeagueFromChannel(interaction.channel.name);
    const playerName = interaction.options.getString("jugador");
    const amount = interaction.options.getInteger("cantidad");

    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando en un canal de fantasy válido (#fantasy-dmg-a / #fantasy-dmg-b).",
        ephemeral: true
      });
    }

    const { managersPath, playersPath, marketPath } = loadLeagueFiles(league);

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const market = JSON.parse(fs.readFileSync(marketPath));

    const manager = managers[userId];
    if (!manager) {
      return interaction.reply({
        content: "❌ No estás inscrito en esta liga. Usa `/joinfantasy`.",
        ephemeral: true
      });
    }

    if (!market.playersOnAuction.includes(playerName)) {
      return interaction.reply({
        content: "🚫 Este jugador **no está en el mercado**.",
        ephemeral: true
      });
    }

    if (manager.credits < amount) {
      return interaction.reply({
        content: "💸 No tienes créditos suficientes.",
        ephemeral: true
      });
    }

    // Asegurar estructura de bids
    if (!market.bids || typeof market.bids !== "object") {
      market.bids = {};
    }
    if (!Array.isArray(market.bids[playerName])) {
      market.bids[playerName] = [];
    }

    // Eliminar puja anterior del mismo usuario
    market.bids[playerName] = market.bids[playerName].filter(b => b.userId !== userId);

    // Nueva puja
    market.bids[playerName].push({ userId, amount });

    fs.writeFileSync(marketPath, JSON.stringify(market, null, 2));

    return interaction.reply({
      content: `🕵️‍♂️ Tu puja por **${playerName}** ha sido registrada en secreto.\n💰 Oferta: **${amount} créditos**`,
      ephemeral: true
    });
  },

  // 🔍 Autocompletado: solo jugadores del mercado en esa liga
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return;

    const { marketPath } = loadLeagueFiles(league);

    const market = JSON.parse(fs.readFileSync(marketPath));
    const playersOnAuction = market.playersOnAuction ?? [];

    const filtered = playersOnAuction
      .filter(p => p.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(p => ({ name: p, value: p }))
    );
  }
};
