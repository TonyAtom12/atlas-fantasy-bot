const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("📚 Muestra todos los comandos del Fantasy Domingueros"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5c3aff)
      .setTitle("📚 Ayuda — Fantasy Domingueros")
      .setDescription("Lista de comandos disponibles para jugar al Fantasy 🏎️")
      .addFields(
        {
          name: "🎮 Gestión de equipo",
          value:
          "• `/joinfantasy` — Unirte al Fantasy\n" +
          "• `/plantilla` — Ver tu equipo\n" +
          "• `/alineacion` — Ajustar titulares/banquillo\n" +
          "• `/miscreditos` — Consultar créditos\n"
        },
        {
          name: "💸 Mercado y fichajes",
          value:
          "• `/market` — Ver jugadores libres\n" +
          "• `/pujar <jugador> <cantidad>` — Pujar por un jugador\n" +
          "• `/fichar <jugador>` — Pagar cláusula\n"
        },
        {
          name: "🔁 Intercambios",
          value:
          "• `/trade_ofrecer` — Proponer trade\n" +
          "• `/trade_listar` — Ver/aceptar/rechazar trades\n"
        },
        {
          name: "📊 Información",
          value:
          "• `/clasificacion` — Ranking Fantasy\n" +
          "• `/valor <jugador>` — Ver valor y cláusula\n" +
          "• `/historial <jugador>` — Ver traspasos\n"
        }
      )
      .setFooter({ text: "Fantasy Domingueros — ¡A por la gloria! 🏆" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
