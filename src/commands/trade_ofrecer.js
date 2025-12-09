const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(channelName) {
  const n = channelName.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    playersPath:   path.join(base, "players.json"),
    managersPath:  path.join(base, "managers.json"),
    tradesPath:    path.join(base, "trades.json"),
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trade_ofrecer")
    .setDescription("🤝 Ofrecer un intercambio a otro manager")
    .addStringOption(o =>
      o.setName("entrego")
        .setDescription("Jugador que entregas")
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(o =>
      o.setName("recibo")
        .setDescription("Jugador que quieres recibir")
        .setRequired(true)
        .setAutocomplete(true)),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league)
      return interaction.reply({ content: "❌ No es un canal Fantasy", ephemeral: true });

    const { playersPath, managersPath, tradesPath } = loadLeagueFiles(league);

    const players = JSON.parse(fs.readFileSync(playersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));

    // 🆕 Cargar o crear correctamente estructura de trades
    let trades;
    if (fs.existsSync(tradesPath)) {
      trades = JSON.parse(fs.readFileSync(tradesPath));
      if (!Array.isArray(trades.offers)) {
        trades.offers = [];
      }
    } else {
      trades = { offers: [] };
    }

    const userId = interaction.user.id;
    const entrego = interaction.options.getString("entrego");
    const recibo = interaction.options.getString("recibo");

    const playerGive = players[entrego];
    const playerWant = players[recibo];

    if (!playerGive || !playerWant)
      return interaction.reply({ content: "❌ Jugadores no encontrados", ephemeral: true });

    if (playerGive.owner !== userId)
      return interaction.reply({ content: "❌ Ese jugador no es tuyo", ephemeral: true });

    const sellerId = playerWant.owner;
    if (!sellerId)
      return interaction.reply({ content: "❌ Ese jugador está libre (usa /pujar)", ephemeral: true });

    if (!managers[sellerId])
      return interaction.reply({ content: "❌ El dueño no existe en esta liga", ephemeral: true });

    if (sellerId === userId)
      return interaction.reply({ content: "🤡 No puedes hacer trade contigo mismo", ephemeral: true });

    // Registrar oferta correcta
    const trade = {
      id: Date.now().toString(),
      league,
      from: userId,
      to: sellerId,
      give: entrego,
      receive: recibo,
      timestamp: Date.now(),
      status: "pending"
    };

    trades.offers.push(trade);
    fs.writeFileSync(tradesPath, JSON.stringify(trades, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0x00cc99)
      .setTitle("📩 Oferta de Trade enviada")
      .setDescription(
        `Has ofrecido **${entrego}** por **${recibo}**\n\n` +
        `📬 <@${sellerId}> recibirá una notificación`
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async autocomplete(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return;

    const { playersPath, managersPath } = loadLeagueFiles(league);

    const players = JSON.parse(fs.readFileSync(playersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const focused = interaction.options.getFocused(true);
    const userId = interaction.user.id;

    let list;

    if (focused.name === "entrego") {
      list = Object.values(players).filter(p => p.owner === userId);
    } else {
      list = Object.values(players)
        .filter(p => p.owner && p.owner !== userId)
        .filter(p => managers[p.owner]?.league === league);
    }

    await interaction.respond(
      list
        .map(p => p.playerName)
        .filter(n => n.toLowerCase().includes(focused.value.toLowerCase()))
        .slice(0, 25)
        .map(name => ({ name, value: name }))
    );
  }
};
