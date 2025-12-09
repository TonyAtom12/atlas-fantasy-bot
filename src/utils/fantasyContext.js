const fs = require("fs");
const path = require("path");

// Mapeo canal → clave interna de fantasy
const fantasyChannelMap = {
  "fantasy-dmg-a": "DominguerosA",
  "fantasy-dmg-b": "DominguerosB",
};

// Nombre bonito para mostrar en embeds / textos
const fantasyDisplayNames = {
  DominguerosA: "Domingueros A",
  DominguerosB: "Domingueros B",
};

function getFantasyKeyFromInteraction(interaction) {
  const channelName = interaction.channel?.name;
  if (!channelName) return null;

  return fantasyChannelMap[channelName] || null;
}

function getFantasyDisplayName(fantasyKey) {
  return fantasyDisplayNames[fantasyKey] || fantasyKey;
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Devuelve todas las rutas de datos para una fantasy concreta
function getFantasyPaths(fantasyKey) {
  const baseFantasyDir = path.join(__dirname, "..", "data", "fantasy", fantasyKey);
  ensureDirExists(baseFantasyDir);

  return {
    fantasyKey,
    fantasyName: getFantasyDisplayName(fantasyKey),
    managersPath: path.join(baseFantasyDir, "managers.json"),
    lineupsPath: path.join(baseFantasyDir, "lineups.json"),
    marketPath: path.join(baseFantasyDir, "market.json"),
    scoresPath: path.join(baseFantasyDir, "scores.json"),

    // players es GLOBAL: mismo archivo para todas las fantasy
    playersPath: path.join(__dirname, "..", "data", "players.json"),
  };
}

function loadJsonSafe(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath);
    if (!raw || raw.length === 0) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  getFantasyKeyFromInteraction,
  getFantasyDisplayName,
  getFantasyPaths,
  loadJsonSafe,
  saveJson,
};
