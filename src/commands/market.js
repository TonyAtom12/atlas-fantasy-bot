const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(channelName) {
  if (channelName.toLowerCase().includes("fantasy-dmg-a")) return "DominguerosA";
  if (channelName.toLowerCase().includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

function loadMarketPath(league) {
  return path.join(__dirname, "..", "data", "fantasy", league, "market.json");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("market")
    .setDescription("Lista los jugadores actualmente en subasta en tu liga"),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) {
      return interaction.reply({
        content: "❌ Usa este comando dentro de un canal #fantasy-dmg-a o #fantasy-dmg-b",
        ephemeral: true
      });
    }

    const marketPath = loadMarketPath(league);

    if (!fs.existsSync(marketPath)) {
      return interaction.reply("❌ No hay datos de mercado para esta liga.");
    }

    const market = JSON.parse(fs.readFileSync(marketPath));
    const playersOnAuction = market.playersOnAuction ?? [];

    if (playersOnAuction.length === 0) {
      return interaction.reply("📭 No hay jugadores en subasta en este momento.");
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd000)
      .setTitle(`🛒 Mercado — ${league} — Semana ${market.week ?? 1}`)
      .setDescription(playersOnAuction.map(p => `• **${p}**`).join("\n"))
      .setFooter({ text: "¡A pujar de forma secreta 😎!" });

    return interaction.reply({ embeds: [embed] });
  }
};
