const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(name) {
  const n = name.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
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
    .setName("plantilla_de")
    .setDescription("📋 Consulta la plantilla de otro jugador de tu liga")
    .addUserOption(opt =>
      opt.setName("usuario")
        .setDescription("Usuario al que quieres consultar")
        .setRequired(true)
    ),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando en un canal de Fantasy válido",
        ephemeral: true
      });
    }

    const userTarget = interaction.options.getUser("usuario");
    const targetId = userTarget.id;

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    const { managersPath, playersPath, lineupsPath, marketPath } = loadLeagueFiles(league);

    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const players  = JSON.parse(fs.readFileSync(playersPath));
    const lineups  = fs.existsSync(lineupsPath) ? JSON.parse(fs.readFileSync(lineupsPath)) : { lineups: {} };
    const market   = fs.existsSync(marketPath)  ? JSON.parse(fs.readFileSync(marketPath))  : { week: 1 };

    const manager = managers[targetId];
    if (!manager) {
      return interaction.reply({
        content: "❌ Ese usuario no está inscrito en esta liga.",
        ephemeral: true
      });
    }

    const team = manager.team || [];
    const currentWeek = market.week || 1;
    const lineup = lineups.lineups?.[targetId];

    const starters = (lineup && lineup.week === currentWeek) ? lineup.starters : [];
    const bench = team.filter(p => !starters.includes(p));

    const fmt = (playerName) => {
      const p = globalPlayers[playerName];
      if (!p) return `• ${playerName}`;
      return `• **${playerName}** — ${p.team} (Div. ${p.division})`;
    };

    const startersList = starters.length
      ? starters.map(fmt).join("\n")
      : "_No tiene titulares marcados_";

    const benchList = bench.length
      ? bench.map(fmt).join("\n")
      : "_No hay suplentes_";

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📋 Plantilla de ${userTarget.username}`)
      .setDescription(`Liga: **${league}**`)
      .addFields(
        { name: `🏁 Titulares Semana ${currentWeek}`, value: startersList },
        { name: "🧩 Suplentes", value: benchList }
      )
      .setFooter({ text: "Consulta tu propia plantilla con /plantilla" });

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
