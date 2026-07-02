// Config plugin: make the Android navigation bar transparent and kill the
// grey contrast scrim.
//
// With edge-to-edge enabled (Android 15 / SDK 54) the system draws a
// semi-opaque "contrast" scrim behind the gesture/nav bar whenever it thinks
// the background doesn't contrast enough. That shows up as a grey bar. The
// only reliable switch is android:enforceNavigationBarContrast=false, which
// app.json's `navigationBar` block does NOT expose — so we inject it (plus a
// transparent nav bar colour and a black window background) straight into
// AppTheme via withAndroidStyles. This runs on every prebuild, so the fix
// survives regenerating the android/ folder.
// Config plugins run in the Node/CommonJS prebuild context, so require() is the
// correct import style here (not ESM).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

const { assignStylesValue, getAppThemeGroup } = AndroidConfig.Styles;

module.exports = function withTransparentNavBar(config) {
  return withAndroidStyles(config, (cfg) => {
    // Match the existing AppTheme by name only (no parent), so we edit the
    // theme prebuild generates (parent Theme.AppCompat.DayNight.NoActionBar)
    // in place instead of spawning a second, conflicting AppTheme group.
    const parent = getAppThemeGroup();
    cfg.modResults = assignStylesValue(cfg.modResults, {
      add: true,
      parent,
      name: 'android:enforceNavigationBarContrast',
      value: 'false',
    });
    cfg.modResults = assignStylesValue(cfg.modResults, {
      add: true,
      parent,
      name: 'android:navigationBarColor',
      value: '@android:color/transparent',
    });
    cfg.modResults = assignStylesValue(cfg.modResults, {
      add: true,
      parent,
      name: 'android:windowBackground',
      value: '@android:color/black',
    });
    return cfg;
  });
};
