require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  MessageFlags
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

// ================================================
// 📦 Cargar comandos
// ================================================
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd?.data && cmd?.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`🟢 Comando cargado: ${cmd.data.name}`);
  }
}

client.once("ready", () => {
  console.log(`🚀 Bot iniciado como ${client.user.tag}`);
});

// ================================================
// 🎮 MANEJO DE INTERACCIONES
// ================================================
client.on("interactionCreate", async interaction => {
  try {
    // ============================================
    // 🔹 AUTOCOMPLETADO
    // ============================================
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) {
        await cmd.autocomplete(interaction);
      }
      return;
    }

if (interaction.isChatInputCommand()) {
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`❌ Error en /${interaction.commandName}:`, err);

    // ⚠️ SOLO si nadie respondió aún
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "⚠ Error inesperado.",
          flags: MessageFlags.Ephemeral
        });
      } catch {
        // interacción ya muerta
      }
    }
  }
  return;
}



    // ============================================
    // 🔘 BOTONES DE TRADE
    // ============================================
    if (interaction.isButton()) {
      const league = getLeagueFromChannel(interaction.channel?.name);
      if (!league) {
        return interaction.reply({
          content: "❌ Este botón no pertenece al Fantasy.",
          flags: MessageFlags.Ephemeral
        });
      }

      const base = path.join(__dirname, "data", "fantasy", league);
      const tradesPath = path.join(base, "trades.json");
      const playersPath = path.join(base, "players.json");
      const managersPath = path.join(base, "managers.json");

      if (!fs.existsSync(tradesPath)) {
        return interaction.reply({
          content: "⚠ No hay trades activos.",
          flags: MessageFlags.Ephemeral
        });
      }

      const trades = JSON.parse(fs.readFileSync(tradesPath));
      const players = JSON.parse(fs.readFileSync(playersPath));
      const managers = JSON.parse(fs.readFileSync(managersPath));

      const userId = interaction.user.id;
      const [, action, tradeId] = interaction.customId.split("_");

      const offer = trades.offers.find(o => o.id === tradeId);
      if (!offer) {
        return interaction.reply({
          content: "❌ Oferta no encontrada.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (offer.to !== userId) {
        return interaction.reply({
          content: "🚫 Esta oferta no es para ti.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (offer.status !== "pending") {
        return interaction.reply({
          content: "⛔ Este trade ya fue resuelto.",
          flags: MessageFlags.Ephemeral
        });
      }

      // ============================================
      // ⏱ ACK inmediato
      // ============================================
      await interaction.deferUpdate();

      // ============================================
      // 🔒 Deshabilitar SOLO los botones de ESTE trade
      // ============================================
      const disabledComponents = interaction.message.components.map(row => ({
        type: 1,
        components: row.components.map(btn => {
          if (btn.customId?.endsWith(tradeId)) {
            return {
              ...btn.data,
              disabled: true
            };
          }
          return btn.data;
        })
      }));

      await interaction.editReply({
        components: disabledComponents
      });

      const pGive = players[offer.give];
      const pReceive = players[offer.receive];
      const mFrom = managers[offer.from];
      const mTo = managers[offer.to];

      if (!pGive || !pReceive || !mFrom || !mTo) {
        return interaction.followUp({
          content: "⚠ Error interno en el trade.",
          flags: MessageFlags.Ephemeral
        });
      }

      // ============================================
      // 🔄 Sincronizar equipos antes
      // ============================================
      Object.values(managers).forEach(m => (m.team = []));
      Object.values(players).forEach(p => {
        if (p.owner && managers[p.owner]) {
          managers[p.owner].team.push(p.playerName);
        }
      });

      // ============================================
      // 🤝 ACEPTAR TRADE
      // ============================================
      if (action === "accept") {
        pGive.owner = offer.to;
        pReceive.owner = offer.from;

        Object.values(managers).forEach(m => (m.team = []));
        Object.values(players).forEach(p => {
          if (p.owner && managers[p.owner]) {
            managers[p.owner].team.push(p.playerName);
          }
        });

        const boost = p => {
          p.value = Math.round(p.value * 1.1);
          p.clause = p.value * 2;
          p.transferHistory ??= [];
          p.transferHistory.push({
            date: Date.now(),
            from: offer.from,
            to: offer.to,
            type: "trade"
          });
        };

        boost(pGive);
        boost(pReceive);

        offer.status = "accepted";

        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
        fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
        fs.writeFileSync(tradesPath, JSON.stringify(trades, null, 2));

        return interaction.followUp({
          content: `🤝 Trade completado: **${offer.give}** ↔ **${offer.receive}**`,
          flags: MessageFlags.Ephemeral
        });
      }

      // ============================================
      // ❌ RECHAZAR TRADE
      // ============================================
      if (action === "reject") {
        offer.status = "rejected";
        fs.writeFileSync(tradesPath, JSON.stringify(trades, null, 2));

        return interaction.followUp({
          content: "❌ Trade rechazado.",
          flags: MessageFlags.Ephemeral
        });
      }
    }
  } catch (err) {
  console.error("❌ ERROR en interaction:", err);

  // ⚠️ NO responder en autocomplete
  if (interaction.isAutocomplete()) {
    return;
  }

  // ⚠️ Solo responder si es una interacción válida
  if (
    interaction.isChatInputCommand() ||
    interaction.isButton() ||
    interaction.isModalSubmit()
  ) {
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "⚠ Error inesperado.",
          flags: MessageFlags.Ephemeral
        });
      } catch (e) {
        // la interacción ya murió, no hacemos nada
      }
    }
  }
}

});

// ================================================
// 🔑 INICIAR BOT
// ================================================
client.login(process.env.DISCORD_TOKEN);
