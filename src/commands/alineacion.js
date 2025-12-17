const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType
} = require("discord.js");
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
    managersPath: path.join(base, "managers.json"),
    playersPath: path.join(base, "players.json"),
    lineupsPath: path.join(base, "lineups.json"),
    marketPath: path.join(base, "market.json")
  };
}

// 🛠 Repara lineups corruptos
function sanitizeLineups(lineups) {
  if (!lineups.lineups) lineups.lineups = {};
  for (const key of Object.keys(lineups)) {
    if (["lineups", "currentWeek"].includes(key)) continue;
    if (/^\d+$/.test(key)) {
      lineups.lineups[key] = lineups[key];
      delete lineups[key];
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("alineacion")
    .setDescription("Elige tus 6 titulares para esta jornada"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "❌ Este comando solo puede usarse en canales de fantasy válidos (#fantasy-dmg-a / #fantasy-dmg-b)",
        ephemeral: true
      });
    }

    const { managersPath, playersPath, lineupsPath, marketPath } = loadLeagueFiles(league);

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const players = JSON.parse(fs.readFileSync(playersPath));
    const market = fs.existsSync(marketPath)
      ? JSON.parse(fs.readFileSync(marketPath))
      : { week: 1 };

    let lineups = fs.existsSync(lineupsPath)
      ? JSON.parse(fs.readFileSync(lineupsPath))
      : { currentWeek: market.week ?? 1, lineups: {} };

    sanitizeLineups(lineups);

    if (!managers[userId]) {
      return interaction.reply({
        content: "❌ No estás inscrito en esta liga. Usa `/joinfantasy`.",
        ephemeral: true
      });
    }

    const team = managers[userId].team || [];
    const currentWeek = market.week ?? lineups.currentWeek ?? 1;

    const existing = lineups.lineups[userId];
    const alreadyForThisWeek =
      existing && existing.week === currentWeek ? existing.starters : [];

    const options = team.map(name => ({
      label: name.substring(0, 100),
      description: `Media: ${players[name]?.average ?? "N/A"}`,
      value: name
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`alineacion_select_${userId}`)
      .setPlaceholder("Selecciona tus titulares")
      .setMinValues(1)
      .setMaxValues(Math.min(6, team.length))
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x00b0f4)
      .setTitle(`🎮 Alineación — Semana ${currentWeek}`)
      .setDescription(
        alreadyForThisWeek.length
          ? `Titulares actuales:\n• ${alreadyForThisWeek.join("\n• ")}`
          : "Selecciona hasta **6 titulares**"
      )
      .setFooter({ text: `Liga: ${league}` });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });

    const message = await interaction.fetchReply();

    // 🟡 Collector con deferUpdate para evitar Unknown Interaction
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.user.id === userId &&
        i.customId === `alineacion_select_${userId}`
    });

    collector.on("collect", async (selectInteraction) => {
      const selected = selectInteraction.values;
      const bench = team.filter(p => !selected.includes(p));

      // Evita Unknown Interaction (10062)
      await selectInteraction.deferUpdate();

      lineups.currentWeek = currentWeek;
      lineups.lineups[userId] = {
        week: currentWeek,
        starters: selected,
        bench
      };

      fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));

      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`✔ Alineación guardada — Semana ${currentWeek}`)
        .setDescription(
          `🎯 Titulares:\n• ${selected.join("\n• ")}\n\n🧢 Suplentes:\n• ${
            bench.length ? bench.join("\n• ") : "— Ninguno —"
          }`
        )
        .setFooter({ text: `Liga: ${league}` });

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: []
      });
    });
  }
};
