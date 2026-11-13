// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the prebuilt SQLite database (assets/db/pokedex.db) as an asset
config.resolver.assetExts.push('db');

module.exports = config;
