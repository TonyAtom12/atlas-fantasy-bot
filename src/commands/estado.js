const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("estado")
        .setDescription("📊 Muestra el estado general del Fantasy")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), // Solo ADMIN

    async execute(interaction) {

        // Cargar datos
        const playersPath = path.join(__dirname, "..", "data", "players.json");
        const scoresPath = path.join(__dirname, "..", "data", "scores.json");
        const managersPath = path.join(__dirname, "..", "data", "managers.json");
        const marketPath = path.join(__dirname, "..", "data", "market.json");

        const players = JSON.parse(fs.readFileSync(playersPath));
        const scores = JSON.parse(fs.readFileSync(scoresPath));
        const managers = JSON.parse(fs.readFileSync(managersPath));
        const market = JSON.parse(fs.readFileSync(marketPath));

        const weekCount = Object.keys(scores.weeks || {}).length || 0;
        const marketOpen = market.open ? "🟢 Abierto" : "🔴 Cerrado";
        const numManagers = Object.keys(managers).length;
        const numPlayers = Object.keys(players).length;
        const playersOnAuction = market.playersOnAuction?.length || 0;
        const pendingBids = market.bids?.length || 0;

        const embed = {
            color: 0x0099ff,
            title: "📊 Estado del Fantasy Domingueros",
            fields: [
                { name: "📅 Semana actual", value: String(weekCount), inline: true },
                { name: "🧑‍💻 Managers inscritos", value: String(numManagers), inline: true },
                { name: "🏎️ Jugadores registrados", value: String(numPlayers), inline: true },
                { name: "🛒 Mercado", value: `${marketOpen}`, inline: true },
                { name: "⚽ Jugadores en subasta", value: String(playersOnAuction), inline: true },
                { name: "💰 Puja pendientes", value: String(pendingBids), inline: true }
            ],
            footer: { text: "Acceso solo administradores" }
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
