const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Identifica la liga según el canal
function getLeagueFromChannel(channelName) {
  if (channelName.toLowerCase().includes("fantasy-dmg-a")) return "DominguerosA";
  if (channelName.toLowerCase().includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
    playersPath: path.join(base, "players.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vender")
    .setDescription("💸 Vender un jugador de tu plantilla")
    .addStringOption(option =>
      option.setName("jugador")
        .setDescription("Nombre del jugador")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const league = getLeagueFromChannel(interaction.channel.name);
    const selectedPlayer = interaction.options.getString("jugador");

    if (!league) {
      return interaction.reply({
        content: "❌ Este comando solo se puede usar en canales #fantasy-dmg-a o #fantasy-dmg-b",
        ephemeral: true
      });
    }

    const { managersPath, playersPath } = loadLeagueFiles(league);

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const playersFantasy = JSON.parse(fs.readFileSync(playersPath));

    const manager = managers[userId];
    if (!manager) {
      return interaction.reply({
        content: "❌ No estás registrado en esta liga.",
        ephemeral: true
      });
    }

    const player = playersFantasy[selectedPlayer];
    if (!player) {
      return interaction.reply({
        content: `❌ El jugador **${selectedPlayer}** no está en tu liga.`,
        ephemeral: true
      });
    }

    if (player.owner !== userId) {
      return interaction.reply({
        content: "🚫 Ese jugador no es tuyo.",
        ephemeral: true
      });
    }

    // Máximo ventas por semana
    if (!manager.weeklySells) manager.weeklySells = 0;
    if (manager.weeklySells >= 2) {
      return interaction.reply({
        content: "❌ Ya vendiste **2 jugadores** esta semana.",
        ephemeral: true
      });
    }

    const currentValue = player.value ?? 10;
    const newValue = Math.max(1, Math.round(currentValue * 0.95)); // -5%

    // Historial de valor tras venta
    if (!player.valueHistory) player.valueHistory = [];
    player.valueHistory.push({
      week: manager.currentWeek ?? 1,
      value: newValue
    });

    // Aplicar cambios
    manager.credits += currentValue;
    manager.team = manager.team.filter(n => n !== selectedPlayer);
    manager.weeklySells++;

    player.owner = null;
    player.status = "free";
    player.value = newValue;

    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(playersPath, JSON.stringify(playersFantasy, null, 2));

    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle("📤 Jugador vendido")
      .setDescription(
        `Has vendido a **${selectedPlayer}** por **${currentValue} créditos**.\n\n` +
        `📉 Nuevo valor del jugador: **${newValue} créditos**\n` +
        `💵 Créditos actuales: **${manager.credits}**`
      )
      .setFooter({ text: `Fantasy Domingueros — ${league}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  // 🔍 AUTOCOMPLETADO DE JUGADORES PROPIOS
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return;

    const { managersPath, playersPath } = loadLeagueFiles(league);

    const userId = interaction.user.id;
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const playersFantasy = JSON.parse(fs.readFileSync(playersPath));

    const team = managers[userId]?.team || [];

    const filtered = team
      .filter(n => n.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(n => ({ name: n, value: n }))
    );
  }
};
