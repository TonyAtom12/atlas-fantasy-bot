const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
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
    playersPath:  path.join(base, "players.json"),
    lineupsPath:  path.join(base, "lineups.json")
  };
}

// ⛔ Excluir usuarios por username (CORRECTO)
const EXCLUDED_USERNAMES = ["Clonador_15", "OxyzO"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joinfantasy_all")
    .setDescription("📢 Inscribe automáticamente a todos los usuarios humanos del canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    await interaction.deferReply();

    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) {
      return interaction.editReply("❌ Este canal no pertenece a ninguna liga válida.");
    }

    // Cargar rutas
    const globalPlayersPath = path.join(__dirname, "..", "data", "fantasy", "players.json");
    const { managersPath, playersPath, lineupsPath } = loadLeagueFiles(league);

    // Datos
    const globalPlayers = JSON.parse(fs.readFileSync(globalPlayersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const leaguePlayers = JSON.parse(fs.readFileSync(playersPath));
    const lineups = JSON.parse(fs.readFileSync(lineupsPath));

    // Miembros humanos del canal
    await interaction.guild.members.fetch();
    const members = interaction.channel.members.filter(m => !m.user.bot);

    let added = [];
    let skipped = [];

    for (const [id, member] of members) {

      const username = member.user.username;
      const userId = member.user.id;

      // ❌ Saltar excluidos
      if (EXCLUDED_USERNAMES.includes(username)) {
        skipped.push(`${username} (excluido)`);
        continue;
      }

      // ❌ Ya está inscrito
      if (managers[userId]) {
        skipped.push(`${username} (ya inscrito)`);
        continue;
      }

      // Buscar jugadores libres
      const freePlayers = Object.values(globalPlayers).filter(gp => {
        const lp = leaguePlayers[gp.playerName];
        return !lp || !lp.owner;
      });

      if (freePlayers.length < 6) {
        skipped.push(`${username} (sin jugadores libres)`);
        continue;
      }

      // Asignar 6 jugadores aleatorios
      const starters = [];

      for (let i = 0; i < 6; i++) {
        const randIndex = Math.floor(Math.random() * freePlayers.length);
        const globalPlayer = freePlayers.splice(randIndex, 1)[0];
        const name = globalPlayer.playerName;

        if (!leaguePlayers[name]) {
          leaguePlayers[name] = {
            playerName: name,
            team: globalPlayer.team,
            division: globalPlayer.division,
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

      // Crear manager
      managers[userId] = {
        username,
        credits: 200,
        team: starters,
        league
      };

      // Crear alineación
      lineups[userId] = {
        week: 1,
        starters,
        bench: []
      };

      added.push(username);

      // 📩 Mensaje privado (sin await para no bloquear)
      const personalEmbed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle("🏁 ¡Te has unido al Fantasy Domingueros!")
        .setDescription(`Has sido inscrito automáticamente en **${league}**`)
        .addFields(
          {
            name: "🏎️ Tu equipo inicial",
            value: starters
              .map(p => {
                const gp = globalPlayers[p];
                return `• **${p}** — ${gp.team} (Div ${gp.division})`;
              })
              .join("\n")
          },
          { name: "💰 Créditos iniciales", value: "200" }
        );

      member.send({ embeds: [personalEmbed] }).catch(() => {});
    }

    // Guardar datos actualizados
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(playersPath, JSON.stringify(leaguePlayers, null, 2));
    fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));

    // Resumen para admin
    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("📢 Inscripción masiva completada")
      .addFields(
        {
          name: "🟢 Inscritos",
          value: added.length > 0 ? added.map(u => `• ${u}`).join("\n") : "Ninguno"
        },
        {
          name: "⚠️ Omitidos",
          value: skipped.length > 0 ? skipped.map(u => `• ${u}`).join("\n") : "Ninguno"
        }
      )
      .setFooter({ text: `Liga: ${league}` });

    return interaction.editReply({ embeds: [embed] });
  }
};
