require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Collection
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// ================================================
// 🎯 Detectar liga según canal
// ================================================
function getLeagueFromChannel(channelName) {
  if (!channelName) return null;
  const n = channelName.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

// ================================================
// 🤖 Inicializar Bot
// ================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// Cargar comandos
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`🟢 Comando cargado: ${cmd.data.name}`);
  }
}

client.once("ready", () =>
  console.log(`🚀 Bot iniciado como ${client.user.tag}`)
);

// ================================================
// 🎮 MANEJO DE INTERACCIONES
// ================================================
client.on("interactionCreate", async interaction => {
  try {
    // 🔹 AUTOCOMPLETADO
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) await cmd.autocomplete(interaction);
      return;
    }

    // 🔹 SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction);
      return;
    }

// ---------------------------------------------
// BOTONES TRADE (Aceptar / Rechazar) — FIX COMPLETO
// ---------------------------------------------
if (interaction.isButton()) {
  const league = getLeagueFromChannel(interaction.channel.name);
  if (!league) return interaction.reply({ content: "❌ Botón inválido en este canal.", ephemeral: true });

  const base = path.join(__dirname, "data", "fantasy", league);
  const tradesPath = path.join(base, "trades.json");
  const playersPath = path.join(base, "players.json");
  const managersPath = path.join(base, "managers.json");

  if (!fs.existsSync(tradesPath)) {
    return interaction.reply({ content: "⚠ No hay trades activos", ephemeral: true });
  }

  const trades = JSON.parse(fs.readFileSync(tradesPath));
  const players = JSON.parse(fs.readFileSync(playersPath));
  const managers = JSON.parse(fs.readFileSync(managersPath));

  const userId = interaction.user.id;
  const [, action, tradeId] = interaction.customId.split("_");
  const offer = trades.offers.find(o => o.id === tradeId);

  if (!offer) {
    return interaction.reply({ content: "❌ Oferta no encontrada.", ephemeral: true });
  }
  if (offer.to !== userId) {
    return interaction.reply({ content: "🚫 No eres el receptor de esta oferta.", ephemeral: true });
  }

  const pGive = players[offer.give];
  const pReceive = players[offer.receive];

  const mFrom = managers[offer.from];
  const mTo = managers[offer.to];

  if (!pGive || !pReceive || !mFrom || !mTo)
    return interaction.reply({ content: "⚠ Error inesperado en el trade", ephemeral: true });

  // 🧹 Sincronizar equipos según owners ANTES del intercambio
  Object.values(managers).forEach(m => m.team = []);
  Object.values(players).forEach(p => {
    if (p.owner && managers[p.owner]) {
      managers[p.owner].team.push(p.playerName);
    }
  });

  if (action === "accept") {
    console.log("🔁 Ejecutando Trade:");

    // Cambiar owner primero
    pGive.owner = offer.to;
    pReceive.owner = offer.from;

    // Volver a sincronizar team con nuevos owners
    Object.values(managers).forEach(m => m.team = []);
    Object.values(players).forEach(p => {
      if (p.owner && managers[p.owner]) {
        managers[p.owner].team.push(p.playerName);
      }
    });

    // Subida de valor
    const updateVal = p => {
      p.value = Math.round(p.value * 1.10);
      p.clause = p.value * 2;
      if (!p.transferHistory) p.transferHistory = [];
      p.transferHistory.push({
        week: Date.now(),
        from: offer.from,
        to: offer.to,
        type: "trade"
      });
    };
    updateVal(pGive);
    updateVal(pReceive);

    offer.status = "accepted";

    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(tradesPath, JSON.stringify(trades, null, 2));

    return interaction.reply({
      content: `🤝 Trade realizado: **${offer.give}** ↔ **${offer.receive}** 🔥`,
      ephemeral: true
    });
  }

  if (action === "reject") {
    offer.status = "rejected";
    fs.writeFileSync(tradesPath, JSON.stringify(trades, null, 2));

    return interaction.reply({
      content: "❌ Has rechazado el intercambio.",
      ephemeral: true
    });
  }
}


  } catch (err) {
    console.error("❌ ERROR en interaction:", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "⚠ Error inesperado", ephemeral: true });
    }
  }
});

// ================================================
// 🔑 INICIAR BOT
// ================================================
client.login(process.env.DISCORD_TOKEN);
