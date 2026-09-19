const { withAndroidManifest } = require('expo/config-plugins');

// Adds Bluetooth Classic/BLE permissions with correct SDK bounds and the
// neverForLocation flag so Android 12+ shows "Nearby devices" instead of Location.
const PERMISSIONS = [
  { name: 'android.permission.BLUETOOTH_SCAN', flags: 'neverForLocation' },
  { name: 'android.permission.BLUETOOTH_CONNECT' },
  { name: 'android.permission.BLUETOOTH', maxSdk: '30' },
  { name: 'android.permission.BLUETOOTH_ADMIN', maxSdk: '30' },
  { name: 'android.permission.ACCESS_FINE_LOCATION', maxSdk: '30' },
];

module.exports = function withBluetoothPermissions(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
      (p) => !PERMISSIONS.some((x) => x.name === p.$['android:name'])
    );
    for (const p of PERMISSIONS) {
      const entry = { $: { 'android:name': p.name } };
      if (p.flags) {
        entry.$['android:usesPermissionFlags'] = p.flags;
        entry.$['tools:targetApi'] = '31';
      }
      if (p.maxSdk) entry.$['android:maxSdkVersion'] = p.maxSdk;
      manifest['uses-permission'].push(entry);
    }
    return mod;
  });
};
