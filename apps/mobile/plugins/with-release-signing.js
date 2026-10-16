// A pasta android/ é gerada a cada prebuild, então a assinatura de release
// entra por aqui. Chave e senhas ficam em ~/.gradle/gradle.properties, fora
// do repositório; sem elas, a release continua assinando com a chave de debug.
const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING_CONFIG = `
        release {
            if (findProperty('MEURACHA_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('MEURACHA_UPLOAD_STORE_FILE'))
                storePassword findProperty('MEURACHA_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('MEURACHA_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('MEURACHA_UPLOAD_KEY_PASSWORD')
            }
        }`;

const DEBUG_SIGNING_IN_RELEASE = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const RELEASE_SIGNING = `            signingConfig findProperty('MEURACHA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`;

// Falha alto se o template mudar: um replace silencioso publicaria a release
// assinada com a chave de debug.
function replaceOnce(source, from, to) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(
      "with-release-signing: trecho esperado não está no app/build.gradle"
    );
  }
  return source.replace(from, to);
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    gradle = replaceOnce(
      gradle,
      "            keyPassword 'android'\n        }\n    }",
      `            keyPassword 'android'\n        }${SIGNING_CONFIG}\n    }`
    );
    gradle = replaceOnce(gradle, DEBUG_SIGNING_IN_RELEASE, RELEASE_SIGNING);
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
