import * as FS from "node:fs";
import * as Path from "node:path";
import type {
  DesktopPrimaryBackendMode,
  DesktopServerExposureMode,
  DesktopUpdateChannel,
  EnvironmentId,
} from "@t3tools/contracts";

import { resolveDefaultDesktopUpdateChannel } from "./updateChannels.ts";

export interface DesktopSettings {
  readonly serverExposureMode: DesktopServerExposureMode;
  readonly primaryBackendMode: DesktopPrimaryBackendMode;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly updateChannel: DesktopUpdateChannel;
  readonly updateChannelConfiguredByUser: boolean;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  serverExposureMode: "local-only",
  primaryBackendMode: "embedded",
  primaryEnvironmentId: null,
  updateChannel: "latest",
  updateChannelConfiguredByUser: false,
};

export function resolveDefaultDesktopSettings(appVersion: string): DesktopSettings {
  return {
    ...DEFAULT_DESKTOP_SETTINGS,
    updateChannel: resolveDefaultDesktopUpdateChannel(appVersion),
  };
}

export function setDesktopServerExposurePreference(
  settings: DesktopSettings,
  requestedMode: DesktopServerExposureMode,
): DesktopSettings {
  return settings.serverExposureMode === requestedMode
    ? settings
    : {
        ...settings,
        serverExposureMode: requestedMode,
      };
}

export function useEmbeddedDesktopBackendPreference(settings: DesktopSettings): DesktopSettings {
  return settings.primaryBackendMode === "embedded" && settings.primaryEnvironmentId === null
    ? settings
    : {
        ...settings,
        primaryBackendMode: "embedded",
        primaryEnvironmentId: null,
      };
}

export function useSavedEnvironmentDesktopBackendPreference(
  settings: DesktopSettings,
  environmentId: EnvironmentId,
): DesktopSettings {
  return settings.primaryBackendMode === "saved-environment" &&
    settings.primaryEnvironmentId === environmentId
    ? settings
    : {
        ...settings,
        primaryBackendMode: "saved-environment",
        primaryEnvironmentId: environmentId,
      };
}

export function setDesktopUpdateChannelPreference(
  settings: DesktopSettings,
  requestedChannel: DesktopUpdateChannel,
): DesktopSettings {
  return {
    ...settings,
    updateChannel: requestedChannel,
    updateChannelConfiguredByUser: true,
  };
}

export function readDesktopSettings(settingsPath: string, appVersion: string): DesktopSettings {
  const defaultSettings = resolveDefaultDesktopSettings(appVersion);

  try {
    if (!FS.existsSync(settingsPath)) {
      return defaultSettings;
    }

    const raw = FS.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      readonly serverExposureMode?: unknown;
      readonly primaryBackendMode?: unknown;
      readonly primaryEnvironmentId?: unknown;
      readonly updateChannel?: unknown;
      readonly updateChannelConfiguredByUser?: unknown;
    };
    const parsedUpdateChannel =
      parsed.updateChannel === "nightly" || parsed.updateChannel === "latest"
        ? parsed.updateChannel
        : null;
    const isLegacySettings = parsed.updateChannelConfiguredByUser === undefined;
    const updateChannelConfiguredByUser =
      parsed.updateChannelConfiguredByUser === true ||
      (isLegacySettings && parsedUpdateChannel === "nightly");

    return {
      serverExposureMode:
        parsed.serverExposureMode === "network-accessible" ? "network-accessible" : "local-only",
      primaryBackendMode:
        parsed.primaryBackendMode === "saved-environment" ? "saved-environment" : "embedded",
      primaryEnvironmentId:
        typeof parsed.primaryEnvironmentId === "string" && parsed.primaryEnvironmentId.length > 0
          ? (parsed.primaryEnvironmentId as EnvironmentId)
          : null,
      updateChannel:
        updateChannelConfiguredByUser && parsedUpdateChannel !== null
          ? parsedUpdateChannel
          : defaultSettings.updateChannel,
      updateChannelConfiguredByUser,
    };
  } catch {
    return defaultSettings;
  }
}

export function writeDesktopSettings(settingsPath: string, settings: DesktopSettings): void {
  const directory = Path.dirname(settingsPath);
  const tempPath = `${settingsPath}.${process.pid}.${Date.now()}.tmp`;
  FS.mkdirSync(directory, { recursive: true });
  FS.writeFileSync(tempPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  FS.renameSync(tempPath, settingsPath);
}
