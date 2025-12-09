const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// 🏆 Detectar liga según canal
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
    marketPath: path.join(base, "market.json"),
    scoresPath: path.join(base, "scores.json")
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
    
      const sellerId = player.owner;
      if (!sellerId)
        return interaction.reply({ content: "❌ Jugador libre. Debes pujar", ephemeral: true });
    
      if (sellerId === buyerId)
        return interaction.reply({ content: "🤡 Ya es tuyo", ephemeral: true });
    
      const seller = managers[sellerId];
    
      if (seller.league !== league)
        return interaction.reply({ content: "🚫 No puedes fichar de otra liga", ephemeral: true });
    
      const currentWeek = market.week ?? 1;
    
      // Límite de 1 clausulazo recibido por semana
      if (seller.clauseLossWeek === currentWeek)
        return interaction.reply({ content: "🛑 Ese equipo ya ha sufrido un clausulazo esta semana", ephemeral: true });
    
      const clause = player.clause ?? player.value * 2;
    
      if (buyer.credits < clause)
        return interaction.reply({ content: `❌ Te faltan **${clause - buyer.credits}** créditos`, ephemeral: true });
    
      if (buyer.team.length >= 10)
        return interaction.reply({ content: "❌ Plantilla llena (10/10)", ephemeral: true });
    
      // 💸 Transferencia económica
      buyer.credits -= clause;
      seller.credits += clause;
    
      // Transferencia deportiva
      buyer.team.push(playerName);
      seller.team = seller.team.filter(p => p !== playerName);
      player.owner = buyerId;
    
      // 📈 Subida de valor del jugador
      player.value = Math.round(player.value * 1.05);
      player.clause = player.value * 2;
    
      // Registro del clausulazo
      seller.clauseLoss = (seller.clauseLoss ?? 0) + 1;
      seller.clauseLossWeek = currentWeek;
    
      // Añadir a suplentes si existe alineación
      if (!lineups.lineups) lineups.lineups = {};
      if (!lineups.lineups[buyerId])
        lineups.lineups[buyerId] = { week: currentWeek, starters: [], bench: [] };
    
      if (!lineups.lineups[buyerId].bench.includes(playerName))
        lineups.lineups[buyerId].bench.push(playerName);
    
      // Guardar datos
      fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
      fs.writeFileSync(managersPath, JSON.stringify(managers, null, 2));
      fs.writeFileSync(lineupsPath, JSON.stringify(lineups, null, 2));
    
      const embed = new EmbedBuilder()
        .setColor(0xff4500)
        .setTitle(`🚨 ¡Clausulazo ejecutado!`)
        .setDescription(`**${playerName}** ahora es de **${interaction.user.username}**`)
        .addFields(
          { name: "💰 Cláusula", value: `${clause} créditos`, inline: true },
          { name: "📈 Nuevo valor", value: `${player.value}`, inline: true },
          { name: "🔐 Nueva cláusula", value: `${player.clause}`, inline: true }
        )
        .setFooter({ text: `Semana ${currentWeek}` });
    
      return interaction.reply({ embeds: [embed] });
    }
    ,

  // 🔍 AUTOCOMPLETADO — solo jugadores con dueño en esa liga (no del comprador)
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
      .filter(name => name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map(name => ({ name, value: name }));

    await interaction.respond(filtered);
  }
};
