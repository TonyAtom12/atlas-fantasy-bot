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
    lineupsPath:  path.join(base, "lineups.json")
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
        content: "❌ Debes usar este comando en un canal de fantasy válido (#fantasy-dmg-a / #fantasy-dmg-b)",
        ephemeral: true
      });
    }

    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    const { managersPath, playersPath, lineupsPath } = loadLeagueFiles(league);

    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const leaguePlayers = JSON.parse(fs.readFileSync(playersPath));
    const lineups = JSON.parse(fs.readFileSync(lineupsPath));

    if (managers[userId]) {
      return interaction.reply({
        content: `⚠️ Ya estás inscrito en **${managers[userId].league}**`,
        ephemeral: true
      });
    }

    // --- Jugadores libres en esta liga ---
    const freePlayers = Object.values(globalPlayers).filter(gp => {
      const lp = leaguePlayers[gp.playerName];
      return !lp || !lp.owner; // si no está en liga o está libre, vale
    });

    if (freePlayers.length < 6) {
      return interaction.reply({
        content: "⚠️ No hay suficientes jugadores libres para asignarte el equipo inicial.",
        ephemeral: true
      });
    }

    // --- Asignar 6 jugadores aleatorios ---
    const starters = [];
    for (let i = 0; i < 6; i++) {
      const randIndex = Math.floor(Math.random() * freePlayers.length);
      const globalPlayer = freePlayers.splice(randIndex, 1)[0];

      const name = globalPlayer.playerName;

      // si el jugador no existe en la liga -> clonarlo desde el global
      if (!leaguePlayers[name]) {
        leaguePlayers[name] = {
          playerName: name,
          team: globalPlayer.team,
          totalPoints: globalPlayer.totalPoints,
          average: globalPlayer.average,
          history: globalPlayer.history,
          owner: userId,
          status: "drafted",
          value: globalPlayer.value ?? 120,
          clause: globalPlayer.clause ?? (globalPlayer.value ?? 120) * 2
        };
      } else {
        leaguePlayers[name].owner = userId;
        leaguePlayers[name].status = "drafted";
      }

      starters.push(name);
    }

    // --- Crear manager en la liga ---
    managers[userId] = {
      username,
      credits: 200,
      team: starters,
      league
    };

    // --- Crear alineación inicial ---
    lineups[userId] = {
      week: 1,
      starters,
      bench: []
    };

    // --- Guardar todo ---
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(playersPath, JSON.stringify(leaguePlayers, null, 2));
    fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));

    // --- Respuesta ---
    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("🏁 ¡Bienvenido al Fantasy Domingueros!")
      .setDescription(`Has sido inscrito en **${league}**`)
      .addFields({
        name: "🏎️ Tu Equipo Inicial",
        value: starters
          .map(p => {
            const gp = globalPlayers[p];
            return `• **${p}** — ${gp.team} (Div ${gp.division})`;
          })
          .join("\n")
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
