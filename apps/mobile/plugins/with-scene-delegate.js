// O iOS 27 recusa o app que cria a janela no AppDelegate (ver o comentário
// de ExpoAppSceneDelegate em node_modules/expo). O template do SDK 57 ainda
// cria ali, então este plugin passa a janela para um SceneDelegate a cada
// prebuild.
const fs = require("fs");
const path = require("path");
const {
  IOSConfig,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Ponto de extensão para config plugins.
}
`;

const WINDOW_IN_APP_DELEGATE = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

// Falha alto se o template mudar: um replace silencioso deixaria o app sem
// janela ou com duas.
function replaceOnce(source, from, to, file) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`with-scene-delegate: trecho esperado não está em ${file}`);
  }
  return source.replace(from, to);
}

const withSceneManifest = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });

const withSceneDelegateFiles = (config) =>
  withDangerousMod(config, [
    "ios",
    (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const name = cfg.modRequest.projectName;
      fs.writeFileSync(
        path.join(root, name, "SceneDelegate.swift"),
        SCENE_DELEGATE
      );

      const appDelegatePath = path.join(root, name, "AppDelegate.swift");
      let source = fs.readFileSync(appDelegatePath, "utf8");
      source = replaceOnce(
        source,
        "class AppDelegate: ExpoAppDelegate {",
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
        appDelegatePath
      );
      source = replaceOnce(
        source,
        WINDOW_IN_APP_DELEGATE,
        "    // A janela e o React Native sobem no SceneDelegate.\n",
        appDelegatePath
      );
      fs.writeFileSync(appDelegatePath, source);
      return cfg;
    },
  ]);

const withSceneDelegateInProject = (config) =>
  withXcodeProject(config, (cfg) => {
    const name = cfg.modRequest.projectName;
    const filepath = `${name}/SceneDelegate.swift`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: name,
        project: cfg.modResults,
      });
    }
    return cfg;
  });

module.exports = (config) =>
  withSceneDelegateInProject(withSceneDelegateFiles(withSceneManifest(config)));
