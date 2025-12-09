const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cerrar_semana_global")
    .setDescription("📁 Guarda los totalPoints actuales como semana N y avanza la semana global.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");

    if (!fs.existsSync(globalPlayersPath)) {
      return interaction.reply({ content: "❌ No se encontró players.json global.", ephemeral: true });
    }

    const players = JSON.parse(fs.readFileSync(globalPlayersPath));

    // Determinar la semana actual global mirando los histories
    let currentWeek = 0;
    for (const p of Object.values(players)) {
      const last = p.history?.[p.history.length - 1];
      if (last && last.week > currentWeek) currentWeek = last.week;
    }

    const newWeek = currentWeek + 1;

    // Actualizar todos los jugadores
    for (const p of Object.values(players)) {
      if (!Array.isArray(p.history)) p.history = [];

      p.history.push({
        week: newWeek,
        totalPoints: p.totalPoints || 0
      });
    }

    fs.writeFileSync(globalPlayersPath, JSON.stringify(players, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("📁 Semana global cerrada")
      .setDescription(`Se ha guardado la **semana ${newWeek}** en el historial de todos los jugadores.\n\nAhora puedes actualizar los **totalPoints** para la próxima semana.`)
      .setFooter({ text: `Sistema Fantasy — Semana Global ${newWeek}` });

    return interaction.reply({ embeds: [embed] });
  }
};
