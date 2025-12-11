const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cerrar_semana_global")
    .setDescription("📁 Guarda los totalPoints actuales como semana N y avanza la semana global.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    console.log("========== /cerrar_semana_global ==========");

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    console.log("GLOBAL PATH:", globalPlayersPath);

    // Comprobar existencia del archivo
    const exists = fs.existsSync(globalPlayersPath);
    console.log("¿Existe players.json?:", exists);

    if (!exists) {
      return interaction.reply({ content: "❌ No se encontró players.json global.", ephemeral: true });
    }

    // Leer archivo
    let playersRaw = fs.readFileSync(globalPlayersPath, "utf8");
    console.log("Tamaño archivo JSON:", playersRaw.length, "bytes");

    let players;
    try {
      players = JSON.parse(playersRaw);
    } catch (e) {
      console.log("❌ ERROR PARSEANDO JSON:", e);
      return interaction.reply({ content: "❌ Error leyendo el JSON global.", ephemeral: true });
    }

    const playerKeys = Object.keys(players);
    console.log("Jugadores cargados:", playerKeys.length);

    // Mostrar primeros 3 jugadores para verificar
    console.log("Primeros jugadores:", playerKeys.slice(0, 3));

    // Detectar semana actual
    let currentWeek = 0;
    for (const [name, p] of Object.entries(players)) {
      const last = p.history?.[p.history.length - 1];
      if (last) {
        // log mínimo para no spamear
        if (currentWeek < last.week) currentWeek = last.week;
      }
    }
    console.log("Semana detectada:", currentWeek);

    const newWeek = currentWeek + 1;
    console.log("Nueva semana:", newWeek);

    // Actualizar historial de cada jugador
    console.log("Actualizando historiales...");
    for (const [name, p] of Object.entries(players)) {
      if (!Array.isArray(p.history)) {
        console.log(`⚠ ${name} no tenía history, creando...`);
        p.history = [];
      }

      p.history.push({
        week: newWeek,
        totalPoints: p.totalPoints || 0
      });

      // Log mínimo solo para los primeros 5 jugadores
      if (playerKeys.indexOf(name) < 5) {
        console.log(`✔ Actualizado ${name}:`, p.history[p.history.length - 1]);
      }
    }

    // Guardar archivo
    console.log("Escribiendo archivo actualizado...");
    try {
      fs.writeFileSync(globalPlayersPath, JSON.stringify(players, null, 2));
      console.log("✔ writeFileSync completado sin errores");
    } catch (e) {
      console.log("❌ ERROR al escribir JSON:", e);
      return interaction.reply({ content: "❌ Error guardando el archivo global.", ephemeral: true });
    }

    console.log("========== FIN /cerrar_semana_global ==========\n");

    // Respuesta del bot
    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("📁 Semana global cerrada")
      .setDescription(
        `Se ha guardado la **semana ${newWeek}** en el historial de todos los jugadores.\n\n` +
        `Ahora puedes actualizar los **totalPoints** para la próxima semana.`
      )
      .setFooter({ text: `Sistema Fantasy — Semana Global ${newWeek}` });

    return interaction.reply({ embeds: [embed] });
  }
};
