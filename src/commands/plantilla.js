const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(channelName) {
  if (channelName.toLowerCase().includes("fantasy-dmg-a")) return "DominguerosA";
  if (channelName.toLowerCase().includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
    playersPath:  path.join(base, "players.json"),
    lineupsPath:  path.join(base, "lineups.json"),
    marketPath:   path.join(base, "market.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("plantilla")
    .setDescription("📋 Muestra tu plantilla, créditos y alineación actual"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "❌ Debes usar este comando en un canal de Fantasy (#fantasy-dmg-a / #fantasy-dmg-b)",
        ephemeral: true
      });
    }

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    const { managersPath, playersPath, lineupsPath, marketPath } = loadLeagueFiles(league);

    if (!fs.existsSync(managersPath) || !fs.existsSync(playersPath)) {
      return interaction.reply({ content: "⚠️ Datos incompletos para esta liga.", ephemeral: true });
    }

    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const leaguePlayers = JSON.parse(fs.readFileSync(playersPath));
    const lineups = fs.existsSync(lineupsPath) ? JSON.parse(fs.readFileSync(lineupsPath)) : { lineups: {} };
    const market = fs.existsSync(marketPath) ? JSON.parse(fs.readFileSync(marketPath)) : { week: 1 };

    const manager = managers[userId];
    if (!manager) {
      return interaction.reply({
        content: "❌ No estás inscrito en el Fantasy. Usa `/joinfantasy`.",
        ephemeral: true
      });
    }

    const team = manager.team || [];
    const credits = manager.credits ?? 0;
    const maxTitulares = 6;
    const currentWeek = market.week ?? 1;

    const lineup = lineups.lineups?.[userId];
    const starters = (lineup && lineup.week === currentWeek) ? lineup.starters : [];
    const bench = team.filter(p => !starters.includes(p));

    const mapPlayer = (p) => {
      const pl = globalPlayers[p];
      if (!pl) return `• **${p}**`;
      return `• **${p}** — ${pl.team} (Div. ${pl.division})`;
    };

    const startersList = starters.length
      ? starters.map(mapPlayer).join("\n")
      : "_No has marcado titulares aún_";

    const benchList = bench.length
      ? bench.map(mapPlayer).join("\n")
      : "_No hay suplentes_";

    const embed = new EmbedBuilder()
      .setColor(0x3366ff)
      .setTitle(`📋 Tu Plantilla — ${league}`)
      .addFields(
        { name: "💰 Créditos restantes", value: `${credits}`, inline: true },
        {
          name: `🏁 Titulares Semana ${currentWeek} [${starters.length}/${maxTitulares}]`,
          value: startersList
        },
        {
          name: "🧩 Suplentes",
          value: benchList
        }
      )
      .setFooter({ text: "Actualiza tu alineación con /alineacion" });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
