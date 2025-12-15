const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// ============================
// 🔍 Detectar liga
// ============================
function getLeagueFromChannel(name) {
  const n = name.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

// ============================
// 📁 Rutas
// ============================
function loadLeagueFiles(league) {
  const base = path.join(__dirname, "..", "data", "fantasy", league);
  return {
    managersPath: path.join(base, "managers.json"),
    playersPath:  path.join(base, "players.json"),
    lineupsPath:  path.join(base, "lineups.json"),
    marketPath:   path.join(base, "market.json")
  };
}

// ============================
// 🧹 LIMPIEZA GLOBAL DE LINEUPS
// ============================
function removePlayerFromAllLineups(playerName, lineups) {
  if (!lineups.lineups) return;

  for (const uid of Object.keys(lineups.lineups)) {
    const l = lineups.lineups[uid];
    l.starters = (l.starters || []).filter(p => p !== playerName);
    l.bench    = (l.bench || []).filter(p => p !== playerName);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fichar")
    .setDescription("💥 Pagar cláusula y fichar jugador inmediatamente")
    .addStringOption(opt =>
      opt.setName("jugador")
        .setDescription("Jugador a fichar 😈")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league)
      return interaction.reply({ content: "❌ No estás en un canal de Fantasy", ephemeral: true });

    const { managersPath, playersPath, lineupsPath, marketPath } = loadLeagueFiles(league);

    const managers = JSON.parse(fs.readFileSync(managersPath));
    const players  = JSON.parse(fs.readFileSync(playersPath));
    const lineups  = fs.existsSync(lineupsPath)
      ? JSON.parse(fs.readFileSync(lineupsPath))
      : { lineups: {} };
    const market   = JSON.parse(fs.readFileSync(marketPath));

    const buyerId = interaction.user.id;
    const buyer   = managers[buyerId];
    const playerName = interaction.options.getString("jugador");
    const player = players[playerName];

    if (!buyer)
      return interaction.reply({ content: "❌ No estás inscrito en esta liga", ephemeral: true });

    if (!player)
      return interaction.reply({ content: "❌ Ese jugador no existe", ephemeral: true });

    const sellerId = player.owner;
    if (!sellerId)
      return interaction.reply({ content: "❌ Jugador libre, usa el mercado", ephemeral: true });

    if (sellerId === buyerId)
      return interaction.reply({ content: "🤡 Ese jugador ya es tuyo", ephemeral: true });

    const seller = managers[sellerId];

    // Normalizar valores
    buyer.credits  = Number(buyer.credits);
    seller.credits = Number(seller.credits);
    player.value   = Number(player.value ?? 120);
    player.clause  = Number(player.clause ?? player.value * 2);

    const clause = player.clause;
    const currentWeek = market.week ?? 1;

    if (buyer.credits < clause)
      return interaction.reply({
        content: `❌ Te faltan **${clause - buyer.credits}** créditos`,
        ephemeral: true
      });

    if (buyer.team.length >= 10)
      return interaction.reply({ content: "❌ Tu plantilla está llena (10)", ephemeral: true });

    if (seller.clauseLossWeek === currentWeek)
      return interaction.reply({
        content: "🛑 Ese equipo ya ha sufrido un clausulazo esta semana",
        ephemeral: true
      });

    // ============================
    // 💰 TRANSFERENCIA ECONÓMICA
    // ============================
    buyer.credits  -= clause;
    seller.credits += clause;

    // ============================
    // 🧹 LIMPIAR LINEUPS (CLAVE)
    // ============================
    removePlayerFromAllLineups(playerName, lineups);

    // ============================
    // 🔄 TRANSFERENCIA DE JUGADOR
    // ============================
    seller.team = seller.team.filter(p => p !== playerName);
    buyer.team.push(playerName);
    player.owner = buyerId;

    // Subida de valor
    player.value  = Math.round(player.value * 1.05);
    player.clause = player.value * 2;

    // Clausulazo registrado
    seller.clauseLoss = (seller.clauseLoss ?? 0) + 1;
    seller.clauseLossWeek = currentWeek;

    // ============================
    // 🪑 BANQUILLO AUTOMÁTICO
    // ============================
    if (!lineups.lineups[buyerId]) {
      lineups.lineups[buyerId] = { week: currentWeek, starters: [], bench: [] };
    }

    lineups.lineups[buyerId].bench.push(playerName);

    // ============================
    // 💾 GUARDAR TODO
    // ============================
    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));

    // ============================
    // 📣 EMBED FINAL
    // ============================
    const embed = new EmbedBuilder()
      .setColor(0xff4500)
      .setTitle("🚨 ¡CLAUSULAZO!")
      .setDescription(`**${playerName}** ahora juega para **${interaction.user.username}**`)
      .addFields(
        { name: "💰 Cláusula pagada", value: `${clause}`, inline: true },
        { name: "📈 Nuevo valor", value: `${player.value}`, inline: true },
        { name: "🔐 Nueva cláusula", value: `${player.clause}`, inline: true }
      )
      .setFooter({ text: `Liga ${league} — Semana ${currentWeek}` });

    return interaction.reply({ embeds: [embed] });
  },

  // ============================
  // 🔍 AUTOCOMPLETE
  // ============================
  async autocomplete(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return interaction.respond([]);

    const { playersPath } = loadLeagueFiles(league);
    const players = JSON.parse(fs.readFileSync(playersPath));
    const focused = interaction.options.getFocused().toLowerCase();

    const results = Object.values(players)
      .filter(p => p.owner)
      .map(p => p.playerName)
      .filter(n => n.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(n => ({ name: n, value: n }));

    await interaction.respond(results);
  }
};
