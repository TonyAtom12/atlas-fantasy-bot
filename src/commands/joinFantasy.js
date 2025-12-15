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
    .setName("joinfantasy")
    .setDescription("Únete al Fantasy Domingueros en tu liga activa"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const league = getLeagueFromChannel(interaction.channel.name);

    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando en un canal de fantasy válido.",
        ephemeral: true
      });
    }

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    const { managersPath, playersPath, lineupsPath, marketPath } = loadLeagueFiles(league);

    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const leaguePlayers = JSON.parse(fs.readFileSync(playersPath));
    const lineups = JSON.parse(fs.readFileSync(lineupsPath));

    const market = fs.existsSync(marketPath)
      ? JSON.parse(fs.readFileSync(marketPath))
      : { playersOnAuction: [] };

    // 🔒 Blindaje estructura
    if (!lineups.lineups) lineups.lineups = {};
    if (!lineups.currentWeek) lineups.currentWeek = 1;

    if (managers[userId]) {
      return interaction.reply({
        content: "⚠️ Ya estás inscrito en esta liga.",
        ephemeral: true
      });
    }

    // 🔎 Jugadores libres y NO en mercado
    const freePlayers = Object.values(globalPlayers).filter(p => {
      const lp = leaguePlayers[p.playerName];
      const inMarket = market.playersOnAuction?.includes(p.playerName);
      return (!lp || !lp.owner) && !inMarket;
    });

    if (freePlayers.length < 6) {
      return interaction.reply({
        content: "⚠️ No hay suficientes jugadores libres fuera del mercado.",
        ephemeral: true
      });
    }

    // 🎲 Asignar 6 jugadores
    const starters = [];

    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * freePlayers.length);
      const gp = freePlayers.splice(idx, 1)[0];
      const name = gp.playerName;

      leaguePlayers[name] = {
        playerName: name,
        team: gp.team,
        totalPoints: gp.totalPoints,
        average: gp.average,
        history: gp.history,
        owner: userId,
        status: "drafted",
        value: gp.value ?? 120,
        clause: gp.clause ?? (gp.value ?? 120) * 2
      };

      starters.push(name);
    }

    // 👤 Manager
    managers[userId] = {
      username,
      credits: 200,
      team: starters,
      league
    };

    // 🧾 Lineup BIEN guardado
    lineups.lineups[userId] = {
      week: lineups.currentWeek,
      starters,
      bench: []
    };

    // 💾 Guardar
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(playersPath, JSON.stringify(leaguePlayers, null, 2));
    fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));

    // 📣 Respuesta
    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("🏁 ¡Bienvenido al Fantasy Domingueros!")
      .setDescription(`Inscrito correctamente en **${league}**`)
      .addFields({
        name: "🏎️ Tu equipo inicial",
        value: starters.join("\n")
      })
      .addFields({
        name: "💰 Créditos",
        value: "200",
        inline: true
      })
      .setFooter({ text: `Liga: ${league}` });

    return interaction.reply({ embeds: [embed] });
  }
};
