const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Detecta la liga según el canal
function getLeagueFromChannel(channelName) {
  const name = channelName.toLowerCase();
  if (name.includes("fantasy-dmg-a")) return "DominguerosA";
  if (name.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("historial")
    .setDescription("📈 Muestra la evolución del valor de un jugador en tu liga")
    .addStringOption(opt =>
      opt.setName("jugador")
        .setDescription("Selecciona un jugador")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "🚫 Este comando solo puede usarse en canales Fantasy (#fantasy-dmg-a / #fantasy-dmg-b).",
        ephemeral: true
      });
    }

    const userInput = interaction.options.getString("jugador");

    const playersPath = path.join(__dirname, "..", "data", "fantasy", league, "players.json");
    if (!fs.existsSync(playersPath)) {
      return interaction.reply({
        content: "⚠️ No hay datos de jugadores en esta liga todavía.",
        ephemeral: true
      });
    }

    const players = JSON.parse(fs.readFileSync(playersPath));
    const player = players[userInput];

    if (!player) {
      return interaction.reply({
        content: `❌ El jugador **${userInput}** no existe en esta liga.`,
        ephemeral: true
      });
    }

    if (!player.valueHistory || player.valueHistory.length === 0) {
      return interaction.reply({
        content: `ℹ️ **${player.playerName}** aún no tiene historial de valor.`,
        ephemeral: true
      });
    }

    const history = [...player.valueHistory].sort((a, b) => a.week - b.week);
    let lines = [];
    let tendenciaTexto = "Sin cambios";
    let frasePersonaje = "";
    let lastDelta = 0;

    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      const week = h.week;
      const value = h.value;

      if (i === 0) {
        lines.push(`S${week} — ${value}`);
      } else {
        const prev = history[i - 1];
        const delta = value - prev.value;
        lastDelta = delta;

        let icon = "➡️";
        let deltaText = "";
        if (delta > 0) { icon = "📈"; deltaText = `(+${delta})`; }
        if (delta < 0) { icon = "📉"; deltaText = `(${delta})`; }

        lines.push(`S${week} — ${value} ${icon} ${deltaText}`);
      }
    }

    if (lastDelta > 0)
      frasePersonaje = `😏 “Subidita rica… ¡aprovéchame ahora!”`;
    else if (lastDelta < 0)
      frasePersonaje = `💔 “Volveré a brillar…”`;
    else
      frasePersonaje = `😐 “Estoy estable… de momento.”`;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📈 Evolución del valor — ${player.playerName}`)
      .setDescription(lines.join("\n"))
      .addFields({ name: "Liga", value: league })
      .addFields({ name: "📊 Tendencia", value: tendenciaTexto })
      .addFields({ name: "💬 Comentario del jugador", value: frasePersonaje })
      .setFooter({ text: "Fantasy Domingueros — Mercado en movimiento" });

    return interaction.reply({ embeds: [embed], ephemeral: false });
  },

  // AUTOCOMPLETADO 🔍
  async autocomplete(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return interaction.respond([]);

    const playersPath = path.join(__dirname, "..", "data", "fantasy", league, "players.json");
    if (!fs.existsSync(playersPath)) return interaction.respond([]);

    const players = JSON.parse(fs.readFileSync(playersPath));
    const focused = interaction.options.getFocused().toLowerCase();

    const matches = Object.values(players)
      .filter(p => p.playerName.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.playerName, value: p.playerName }));

    await interaction.respond(matches);
  }
};
