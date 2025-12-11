const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debug_rutas")
    .setDescription("🧪 Muestra las rutas reales desde las que el bot está cargando archivos")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    console.log("🔍 DEBUG – EJECUTADO /debug_rutas");
    console.log("📌 process.cwd():", process.cwd());
    console.log("📁 __dirname:", __dirname);

    // Ruta real que usa el comando cerrar_semana_global
    const playersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");

    console.log("📄 Ruta calculada de players.json:", playersPath);
    console.log("📦 Existe el archivo?:", fs.existsSync(playersPath));

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("🧪 DEBUG DE RUTAS")
      .addFields(
        { name: "process.cwd()", value: `\`${process.cwd()}\`` },
        { name: "__dirname", value: `\`${__dirname}\`` },
        { name: "players.json buscado en:", value: `\`${playersPath}\`` },
        { name: "¿Existe players.json?", value: fs.existsSync(playersPath) ? "✅ Sí" : "❌ No" }
      )
      .setFooter({ text: "Usa esta información para corregir rutas o mover archivos." });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
