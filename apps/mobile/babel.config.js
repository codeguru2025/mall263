module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo lives at the monorepo root and cannot resolve expo-router
  // (which is only in apps/mobile/node_modules), so hasModule('expo-router') returns
  // false inside the preset. We add the router plugin explicitly here where it IS resolvable.
  const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');
  return {
    presets: ['babel-preset-expo'],
    plugins: [expoRouterBabelPlugin],
  };
};
