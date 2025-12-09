const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const fs = require("fs");
const path = require("path");

function getLeagueFromChannel(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("fantasy-dmg-a")) return "DominguerosA";
  if (n.includes("fantasy-dmg-b")) return "DominguerosB";
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trade_listar")
    .setDescription("📬 Ver ofertas de intercambio pendientes"),

  async execute(interaction) {
    const league = getLeagueFromChannel(interaction.channel.name);
    if (!league) return interaction.reply({ content: "❌ Canal no válido para Fantasy", ephemeral: true });

    const base = path.join(__dirname, "..", "data", "fantasy", league);
    const tradesPath = path.join(base, "trades.json");

    if (!fs.existsSync(tradesPath)) {
      return interaction.reply({ content: "📭 No tienes ofertas pendientes", ephemeral: true });
    }

    const trades = JSON.parse(fs.readFileSync(tradesPath));
    const userId = interaction.user.id;

    const offers = trades.offers.filter(o => o.to === userId && o.status === "pending");

    if (offers.length === 0) {
      return interaction.reply({ content: "📭 No tienes ofertas pendientes", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle("📬 Ofertas de Trade Pendientes");

    const rows = [];

    offers.forEach((offer, i) => {
      embed.addFields({
        name: `📌 Oferta #${i + 1}`,
        value: `De: <@${offer.from}>\n🔁 Recibir: **${offer.receive}**\n💨 Dar: **${offer.give}**`
      });

      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade_accept_${offer.id}`)
          .setLabel("Aceptar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade_reject_${offer.id}`)
          .setLabel("Rechazar")
          .setStyle(ButtonStyle.Danger)
      ));
    });

    await interaction.reply({
      embeds: [embed],
      components: rows,
      ephemeral: true
    });
  }
};
