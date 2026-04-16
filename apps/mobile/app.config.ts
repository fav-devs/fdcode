import type { ExpoConfig } from "expo/config";

type AppVariant = "development" | "preview" | "production";

const APP_VARIANT = resolveAppVariant(process.env.APP_VARIANT);

const VARIANT_CONFIG: Record<
  AppVariant,
  {
    readonly appName: string;
    readonly iosIcon: string;
    readonly iosBundleIdentifier: string;
    readonly androidPackage: string;
  }
> = {
  development: {
    appName: "fdcode Dev",
    iosIcon: "./assets/icon-composer-dev.icon",
    iosBundleIdentifier: "com.favdevs.fdcode.dev",
    androidPackage: "com.favdevs.fdcode.dev",
  },
  preview: {
    appName: "fdcode Preview",
    iosIcon: "./assets/icon-composer-prod.icon",
    iosBundleIdentifier: "com.favdevs.fdcode.preview",
    androidPackage: "com.favdevs.fdcode.preview",
  },
  production: {
    appName: "fdcode",
    iosIcon: "./assets/icon-composer-prod.icon",
    iosBundleIdentifier: "com.favdevs.fdcode",
    androidPackage: "com.favdevs.fdcode",
  },
};

function resolveAppVariant(value: string | undefined): AppVariant {
  switch (value) {
    case "development":
    case "preview":
    case "production":
      return value;
    default:
      return "production";
  }
}

const variant = VARIANT_CONFIG[APP_VARIANT];

const config: ExpoConfig = {
  name: variant.appName,
  slug: "fdcode",
  scheme: "fdcode",
  version: "0.1.0",
  runtimeVersion: {
    policy: "appVersion",
  },
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  updates: {
    enabled: true,
    url: "https://u.expo.dev/d579208b-1405-4c71-b868-315979b80026",
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    icon: variant.iosIcon,
    supportsTablet: true,
    bundleIdentifier: variant.iosBundleIdentifier,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    icon: "./assets/icon.png",
    package: variant.androidPackage,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-camera",
      {
        cameraPermission: "Allow fdcode to access your camera so you can scan pairing QR codes.",
        barcodeScannerEnabled: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        imageWidth: 220,
        dark: {
          image: "./assets/splash-icon.png",
          backgroundColor: "#0a0a0a",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.1",
        },
      },
    ],
    "expo-secure-store",
    "expo-router",
    "./plugins/withAndroidCleartextTraffic.cjs",
  ],
  extra: {
    appVariant: APP_VARIANT,
    eas: {
      projectId: "d579208b-1405-4c71-b868-315979b80026",
    },
  },
  owner: "babalolafavour",
};

export default config;
