const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Detectar liga según canal
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
    playersPath: path.join(base, "players.json"),
    lineupsPath: path.join(base, "lineups.json"),
    marketPath: path.join(base, "market.json")
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fichar")
    .setDescription("💥 Pagar cláusula y fichar jugador inmediatamente")
    .addStringOption(opt =>
      opt.setName("jugador")
        .setDescription("Jugador a robar 😈")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league)
      return interaction.reply({ content: "❌ No estás en un canal de Fantasy", ephemeral: true });

    const { managersPath, playersPath, lineupsPath, marketPath } = loadLeagueFiles(league);

    const players = JSON.parse(fs.readFileSync(playersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));
    const lineups = fs.existsSync(lineupsPath) ? JSON.parse(fs.readFileSync(lineupsPath)) : { lineups: {} };
    const market = JSON.parse(fs.readFileSync(marketPath));

    const buyerId = interaction.user.id;
    const playerName = interaction.options.getString("jugador");
    const buyer = managers[buyerId];
    const player = players[playerName];

    if (!buyer) return interaction.reply({ content: "❌ No estás inscrito en Fantasy", ephemeral: true });
    if (!player) return interaction.reply({ content: `❌ El jugador **${playerName}** no existe`, ephemeral: true });

    // Normalizar valores numéricos
    player.value = Number(player.value ?? 120);
    player.clause = Number(player.clause ?? player.value * 2);

    const sellerId = player.owner;
    if (!sellerId)
      return interaction.reply({ content: "❌ Jugador libre. Debes pujar", ephemeral: true });

    if (sellerId === buyerId)
      return interaction.reply({ content: "🤡 Ya es tuyo", ephemeral: true });

    const seller = managers[sellerId];
    seller.credits = Number(seller.credits);
    buyer.credits = Number(buyer.credits);

    const currentWeek = market.week ?? 1;

    if (seller.clauseLossWeek === currentWeek)
      return interaction.reply({ content: "🛑 Ese equipo ya ha sufrido un clausulazo esta semana", ephemeral: true });

    const clause = player.clause;

    if (buyer.credits < clause)
      return interaction.reply({ content: `❌ Te faltan **${clause - buyer.credits}** créditos`, ephemeral: true });

    if (buyer.team.length >= 10)
      return interaction.reply({ content: "❌ Plantilla llena (10/10)", ephemeral: true });

    // Transferencia económica
    buyer.credits -= clause;
    seller.credits += clause;

    // Transferencia deportiva
    buyer.team.push(playerName);
    seller.team = seller.team.filter(p => p !== playerName);
    player.owner = buyerId;

    // Subida de valor
    player.value = Math.round(player.value * 1.05);
    player.clause = player.value * 2;

    // Registrar clausulazo
    seller.clauseLoss = (seller.clauseLoss ?? 0) + 1;
    seller.clauseLossWeek = currentWeek;

    // Banquillo automático
    if (!lineups.lineups) lineups.lineups = {};
    if (!lineups.lineups[buyerId])
      lineups.lineups[buyerId] = { week: currentWeek, starters: [], bench: [] };

    if (!lineups.lineups[buyerId].bench.includes(playerName))
      lineups.lineups[buyerId].bench.push(playerName);

    // Guardar datos
    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
    fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
    fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));

    // 🚨 **NOTIFICAR AL VICTIMARIO POR DM**
    try {
      const sellerUser = await interaction.client.users.fetch(sellerId);
      await sellerUser.send({
        content:
          `🚨 **Te han hecho un clausulazo en ${league}**\n\n` +
          `• 👤 Jugador robado: **${playerName}**\n` +
          `• 🪓 Robado por: **${interaction.user.username}**\n` +
          `• 💰 Cláusula pagada: **${clause} créditos**\n` +
          `• 📅 Semana: **${currentWeek}**`
      });
    } catch (e) {
      // Si tiene DMs cerrados, no pasa nada
    }

    const embed = new EmbedBuilder()
      .setColor(0xff4500)
      .setTitle("🚨 ¡Clausulazo ejecutado!")
      .setDescription(`**${playerName}** ahora es de **${interaction.user.username}**`)
      .addFields(
        { name: "💰 Cláusula", value: `${clause} créditos`, inline: true },
        { name: "📈 Nuevo valor", value: `${player.value}`, inline: true },
        { name: "🔐 Nueva cláusula", value: `${player.clause}`, inline: true }
      )
      .setFooter({ text: `Semana ${currentWeek}` });

    return interaction.reply({ embeds: [embed] });
  },

  // Autocompletado
  async autocomplete(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return interaction.respond([]);

    const { playersPath, managersPath } = loadLeagueFiles(league);

    const focused = interaction.options.getFocused();
    const players = JSON.parse(fs.readFileSync(playersPath));
    const managers = JSON.parse(fs.readFileSync(managersPath));

    const choices = Object.values(players)
      .filter(p => p.owner && managers[p.owner]?.league === league)
      .map(p => p.playerName);

    const filtered = choices
      .filter(n => n.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map(n => ({ name: n, value: n }));

    await interaction.respond(filtered);
  }
};
