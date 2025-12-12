const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");

// ================================
// 🧠 Cache mercado (autocomplete)
// ================================
const marketCache = {};

function getMarketCached(marketPath) {
  if (!marketCache[marketPath]) {
    marketCache[marketPath] = JSON.parse(
      fs.readFileSync(marketPath, "utf8")
    );
  }
  return marketCache[marketPath];
}

// =================================
// 🎯 Detecta liga por canal
// =================================
function getLeagueFromChannel(channelName) {
  if (!channelName) return null;
  const n = channelName.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

// =================================
// 📂 Rutas por liga
// =================================
function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
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

  // =================================
  // 💸 EJECUCIÓN PUJA (SIN DEFER)
  // =================================
  async execute(interaction) {
    const userId = interaction.user.id;
    const league = getLeagueFromChannel(interaction.channel?.name);
    const playerName = interaction.options.getString("jugador");
    const amount = interaction.options.getInteger("cantidad");

    // Canal incorrecto
    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando en un canal de fantasy válido.",
        flags: MessageFlags.Ephemeral
      });
    }

    // Cantidad inválida
    if (amount <= 0) {
      return interaction.reply({
        content: "🚫 La cantidad debe ser un número positivo mayor que 0.",
        flags: MessageFlags.Ephemeral
      });
    }

    const { managersPath, marketPath } = loadLeagueFiles(league);

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const market = JSON.parse(fs.readFileSync(marketPath));

    const manager = managers[userId];
    if (!manager) {
      return interaction.reply({
        content: "❌ No estás inscrito en esta liga. Usa `/joinfantasy`.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!market.playersOnAuction?.includes(playerName)) {
      return interaction.reply({
        content: "🚫 Este jugador no está en el mercado.",
        flags: MessageFlags.Ephemeral
      });
    }

    // Aviso si no tiene créditos suficientes (pero se permite pujar)
    let warning = "";
    if ((manager.credits ?? 0) < amount) {
      warning =
        "\n⚠️ *No tienes créditos suficientes ahora. Si no los consigues antes del cierre, perderás la puja.*";
    }

    // ================================
    // 🧾 Registrar puja
    // ================================
    market.bids ??= {};
    market.bids[playerName] ??= [];

    // Eliminar puja anterior del mismo usuario
    market.bids[playerName] =
      market.bids[playerName].filter(b => b.userId !== userId);

    // Añadir nueva puja
    market.bids[playerName].push({ userId, amount });

    fs.writeFileSync(marketPath, JSON.stringify(market, null, 2));

    // Invalidar cache del autocomplete
    delete marketCache[marketPath];

    return interaction.reply({
      content:
        `🕵️‍♂️ Puja registrada por **${playerName}**\n` +
        `💰 Oferta: **${amount} créditos**${warning}`,
      flags: MessageFlags.Ephemeral
    });
  },

  // =================================
  // 🔍 AUTOCOMPLETE
  // =================================
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused();
      const league = getLeagueFromChannel(interaction.channel?.name);
      if (!league) return interaction.respond([]);

      const { marketPath } = loadLeagueFiles(league);
      const market = getMarketCached(marketPath);

      const filtered = (market.playersOnAuction ?? [])
        .filter(p => p.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25)
        .map(p => ({ name: p, value: p }));

      await interaction.respond(filtered);
    } catch {
      try { await interaction.respond([]); } catch {}
    }
  }
};
