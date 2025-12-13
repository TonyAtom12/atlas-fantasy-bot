const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// =======================================
// 🎯 Detectar liga
// =======================================
function getLeagueFromChannel(channelName) {
  const name = channelName.toLowerCase();
  if (name.includes("fantasy-dmg-a")) return "DominguerosA";
  if (name.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("historial")
    .setDescription("📈 Muestra puntos, valor y trades de un jugador")
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
        content: "🚫 Este comando solo puede usarse en canales Fantasy.",
        ephemeral: true
      });
    }

    const name = interaction.options.getString("jugador");

    const playersPath = path.join(
      __dirname,
      "..",
      "data",
      "fantasy",
      league,
      "players.json"
    );

    if (!fs.existsSync(playersPath)) {
      return interaction.reply({
        content: "⚠️ No hay datos de jugadores en esta liga.",
        ephemeral: true
      });
    }

    const players = JSON.parse(fs.readFileSync(playersPath));
    const player = players[name];

    if (!player) {
      return interaction.reply({
        content: `❌ El jugador **${name}** no existe en esta liga.`,
        ephemeral: true
      });
    }

    // =======================================
    // 📊 HISTORIAL DE PUNTOS
    // =======================================
    let puntosTexto = "Sin datos";
    let tendencia = "😐 Estable";

    if (Array.isArray(player.history) && player.history.length > 0) {
      const ordenado = [...player.history].sort((a, b) => a.week - b.week);

      puntosTexto = ordenado
        .map((h, i) => {
          if (i === 0) return `S${h.week} → ${h.totalPoints}`;
          const prev = ordenado[i - 1].totalPoints;
          const diff = h.totalPoints - prev;

          let icon = "➡️";
          if (diff > 0) icon = "📈";
          if (diff < 0) icon = "📉";

          return `S${h.week} → ${h.totalPoints} ${icon} (${diff >= 0 ? "+" : ""}${diff})`;
        })
        .join("\n");

      if (ordenado.length >= 2) {
        const last = ordenado.at(-1).totalPoints;
        const prev = ordenado.at(-2).totalPoints;
        if (last > prev) tendencia = "📈 En racha";
        else if (last < prev) tendencia = "📉 En caída";
      }
    }

    // =======================================
    // 🔁 HISTORIAL DE TRADES
    // =======================================
    let tradesTexto = "—";

    if (Array.isArray(player.transferHistory) && player.transferHistory.length > 0) {
      tradesTexto = player.transferHistory
        .map(t => {
          const fecha = new Date(t.date).toLocaleDateString("es-ES");
          return `• ${fecha} — ${t.type.toUpperCase()} (<@${t.from}> ➜ <@${t.to}>)`;
        })
        .join("\n");
    }

    // =======================================
    // 📣 EMBED
    // =======================================
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📊 Historial — ${player.playerName}`)
      .addFields(
        { name: "🏁 Equipo", value: player.team || "—", inline: true },
        { name: "👤 Owner", value: player.owner ? `<@${player.owner}>` : "Libre", inline: true },
        { name: "💰 Valor / Cláusula", value: `${player.value} / ${player.clause}`, inline: true },
        { name: "📊 Puntos por semana", value: puntosTexto },
        { name: "🔁 Trades", value: tradesTexto },
        { name: "📈 Tendencia", value: tendencia }
      )
      .setFooter({ text: `Liga ${league}` });

    return interaction.reply({ embeds: [embed] });
  },

  // =======================================
  // 🔍 AUTOCOMPLETE
  // =======================================
  async autocomplete(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return interaction.respond([]);

    const playersPath = path.join(
      __dirname,
      "..",
      "data",
      "fantasy",
      league,
      "players.json"
    );
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
