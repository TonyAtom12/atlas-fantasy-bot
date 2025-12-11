const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

function getLeagueFromChannel(name) {
    const n = name.toLowerCase();
    if (n.includes("fantasy-dmg-a")) return "DominguerosA";
    if (n.includes("fantasy-dmg-b")) return "DominguerosB";
    return null;
}

function loadLeagueFiles(league) {
    const base = path.join(__dirname, "..", "data", "fantasy", league);
    return {
        playersPath:  path.join(base, "players.json"),
        managersPath: path.join(base, "managers.json"),
        marketPath:   path.join(base, "market.json"),
        scoresPath:   path.join(base, "scores.json")
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("estado")
        .setDescription("📊 Muestra el estado general del Fantasy de tu liga")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const league = getLeagueFromChannel(interaction.channel.name);
        if (!league)
            return interaction.reply({ content: "❌ Usa este comando en un canal de Fantasy", ephemeral: true });

        const { playersPath, managersPath, marketPath, scoresPath } = loadLeagueFiles(league);

        // Cargar datos reales de la liga
        const players = JSON.parse(fs.readFileSync(playersPath));
        const managers = JSON.parse(fs.readFileSync(managersPath));
        const market = JSON.parse(fs.readFileSync(marketPath));
        const scores = JSON.parse(fs.readFileSync(scoresPath));

        const weekCount = Object.keys(scores.weeks || {}).length || 0;
        const marketOpen = market.open ? "🟢 Abierto" : "🔴 Cerrado";
        const numManagers = Object.keys(managers).length;
        const numPlayers = Object.keys(players).length;
        const playersOnAuction = market.playersOnAuction?.length || 0;
        const pendingBids = Object.keys(market.bids || {}).length || 0;

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`📊 Estado del Fantasy — ${league}`)
            .addFields(
                { name: "📅 Semana actual", value: String(weekCount), inline: true },
                { name: "🧑‍💻 Managers inscritos", value: String(numManagers), inline: true },
                { name: "🏎️ Jugadores registrados", value: String(numPlayers), inline: true },
                { name: "🛒 Mercado", value: marketOpen, inline: true },
                { name: "⚽ Jugadores en subasta", value: String(playersOnAuction), inline: true },
                { name: "💰 Pujas pendientes", value: String(pendingBids), inline: true }
            )
            .setFooter({ text: "Solo administradores" });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
