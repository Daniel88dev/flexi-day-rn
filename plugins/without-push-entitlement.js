const { withEntitlementsPlist } = require("expo/config-plugins");

// Prebuild runs expo-notifications' own plugin whenever the package is installed, listed or not,
// and it writes the push entitlement a free Apple team cannot sign. Local notifications need
// none. Plugins listed here run their entitlements step after the automatic ones.
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (next) => {
    delete next.modResults["aps-environment"];
    return next;
  });
};
