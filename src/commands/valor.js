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
    playersPath: path.join(base, "players.json"),
    managersPath: path.join(base, "managers.json"),
    marketPath: path.join(base, "market.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("valor")
    .setDescription("💸 Consulta el valor de un jugador del Fantasy")
    .addStringOption(opt =>
      opt.setName("jugador")
        .setDescription("Nombre EXACTO del jugador")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "❌ Este comando solo funciona en un canal de Fantasy.",
        ephemeral: true
      });
    }

    const { playersPath, managersPath, marketPath } = loadLeagueFiles(league);

    const playerName = interaction.options.getString("jugador");
    const players = JSON.parse(fs.readFileSync(playersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const market = JSON.parse(fs.readFileSync(marketPath));

    const player = players[playerName];
    if (!player) {
      return interaction.reply({
        content: `❌ El jugador **${playerName}** no existe en esta liga.`,
        ephemeral: true
      });
    }

    // ---------------------------------------
    // 🔧 VALOR DEL JUGADOR (si no existe, se calcula)
    // ---------------------------------------
    if (!player.value) {
      if (!player.average) {
        return interaction.reply({
          content: `❌ **${playerName}** no tiene media registrada.`,
          ephemeral: true
        });
      }

      player.value = Math.round(player.average * 1.3);

      if (!player.valueHistory) player.valueHistory = [];
      player.valueHistory.push({
        week: market.week ?? 1,
        value: player.value
      });
    }

    const value = player.value;

    // ---------------------------------------
    // 🔐 CLÁUSULA REAL
    // — usar la guardada en players.json
    // — si no existe, generarla correctamente
    // ---------------------------------------
    let clause = player.clause;

    if (!clause) {
      clause = value * 2; // sistema oficial
      player.clause = clause;
    }

    // Guardar cambios si hemos generado valor o cláusula
    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

    // ---------------------------------------
    // 🔎 ESTADO DEL JUGADOR
    // ---------------------------------------
    let estado = "🟢 Libre";
    let detalles = "Puedes pedir que salga al mercado.";

    const inMarket = market.playersOnAuction.includes(playerName);

    if (player.owner && managers[player.owner]) {
      const owner = managers[player.owner];

      estado = `🔒 En plantilla de **${owner.username}**`;

      const loss = owner.clauseLoss ?? 0;
      detalles =
        loss >= 1
          ? "🚫 No se puede aplicar cláusula esta semana a ese manager."
          : "🔐 Solo se puede fichar con cláusula.";
    } else if (inMarket) {
      estado = "📈 En subasta esta semana";
      detalles = "📢 Usa `/pujar` para participar.";
    }

    // ---------------------------------------
    // 📌 EMBED FINAL
    // ---------------------------------------
    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle(`💰 Valor de ${playerName}`)
      .addFields(
        { name: "💸 Valor", value: `${value} créditos`, inline: true },
        { name: "🔐 Cláusula", value: `${clause} créditos`, inline: true },
        { name: "📊 Media", value: player.average ? `${player.average}` : "N/A", inline: true },
        { name: "🌍 Estado", value: `${estado}\n\n${detalles}` }
      )
      .setFooter({ text: `Fantasy ${league} — Consulta de valor` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async autocomplete(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return;

    const { playersPath } = loadLeagueFiles(league);
    const players = JSON.parse(fs.readFileSync(playersPath));

    const focusedValue = interaction.options.getFocused();
    const choices = Object.values(players)
      .map(p => p.playerName)
      .filter(n => n.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(choices.map(c => ({ name: c, value: c })));
  }
};
