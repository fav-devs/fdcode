import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_DESKTOP_SETTINGS,
  readDesktopSettings,
  resolveDefaultDesktopSettings,
  setDesktopServerExposurePreference,
  setDesktopUpdateChannelPreference,
  useEmbeddedDesktopBackendPreference,
  useSavedEnvironmentDesktopBackendPreference,
  writeDesktopSettings,
} from "./desktopSettings.ts";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeSettingsPath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "t3-desktop-settings-test-"));
  tempDirectories.push(directory);
  return path.join(directory, "desktop-settings.json");
}

describe("desktopSettings", () => {
  it("returns defaults when no settings file exists", () => {
    expect(readDesktopSettings(makeSettingsPath(), "0.0.17")).toEqual(DEFAULT_DESKTOP_SETTINGS);
  });

  it("defaults packaged nightly builds to the nightly update channel", () => {
    expect(resolveDefaultDesktopSettings("0.0.17-nightly.20260415.1")).toEqual({
      serverExposureMode: "local-only",
      primaryBackendMode: "embedded",
      primaryEnvironmentId: null,
      updateChannel: "nightly",
      updateChannelConfiguredByUser: false,
    });
  });

  it("persists and reloads the configured server exposure mode", () => {
    const settingsPath = makeSettingsPath();

    writeDesktopSettings(settingsPath, {
      serverExposureMode: "network-accessible",
      primaryBackendMode: "saved-environment",
      primaryEnvironmentId: EnvironmentId.make("environment-remote"),
      updateChannel: "latest",
      updateChannelConfiguredByUser: true,
    });

    expect(readDesktopSettings(settingsPath, "0.0.17")).toEqual({
      serverExposureMode: "network-accessible",
      primaryBackendMode: "saved-environment",
      primaryEnvironmentId: EnvironmentId.make("environment-remote"),
      updateChannel: "latest",
      updateChannelConfiguredByUser: true,
    });
  });

  it("preserves the requested network-accessible preference across temporary fallback", () => {
    expect(
      setDesktopServerExposurePreference(
        {
          serverExposureMode: "local-only",
          primaryBackendMode: "embedded",
          primaryEnvironmentId: null,
          updateChannel: "latest",
          updateChannelConfiguredByUser: false,
        },
        "network-accessible",
      ),
    ).toEqual({
      serverExposureMode: "network-accessible",
      primaryBackendMode: "embedded",
      primaryEnvironmentId: null,
      updateChannel: "latest",
      updateChannelConfiguredByUser: false,
    });
  });

  it("persists the selected saved environment as the primary desktop backend", () => {
    expect(
      useSavedEnvironmentDesktopBackendPreference(
        {
          serverExposureMode: "local-only",
          primaryBackendMode: "embedded",
          primaryEnvironmentId: null,
          updateChannel: "latest",
          updateChannelConfiguredByUser: false,
        },
        EnvironmentId.make("environment-remote"),
      ),
    ).toEqual({
      serverExposureMode: "local-only",
      primaryBackendMode: "saved-environment",
      primaryEnvironmentId: EnvironmentId.make("environment-remote"),
      updateChannel: "latest",
      updateChannelConfiguredByUser: false,
    });
  });

  it("switches the desktop backend preference back to the embedded server", () => {
    expect(
      useEmbeddedDesktopBackendPreference({
        serverExposureMode: "local-only",
        primaryBackendMode: "saved-environment",
        primaryEnvironmentId: EnvironmentId.make("environment-remote"),
        updateChannel: "latest",
        updateChannelConfiguredByUser: false,
      }),
    ).toEqual({
      serverExposureMode: "local-only",
      primaryBackendMode: "embedded",
      primaryEnvironmentId: null,
      updateChannel: "latest",
      updateChannelConfiguredByUser: false,
    });
  });

  it("persists the requested nightly update channel", () => {
    expect(
      setDesktopUpdateChannelPreference(
        {
          serverExposureMode: "local-only",
          primaryBackendMode: "embedded",
          primaryEnvironmentId: null,
          updateChannel: "latest",
          updateChannelConfiguredByUser: false,
        },
        "nightly",
      ),
    ).toEqual({
      serverExposureMode: "local-only",
      updateChannel: "nightly",
      updateChannelConfiguredByUser: true,
    });
  });

  it("falls back to defaults when the settings file is malformed", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(settingsPath, "{not-json", "utf8");

    expect(readDesktopSettings(settingsPath, "0.0.17")).toEqual(DEFAULT_DESKTOP_SETTINGS);
  });

  it("falls back to the nightly channel for legacy nightly settings without an update track", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify({ serverExposureMode: "local-only" }), "utf8");

    expect(readDesktopSettings(settingsPath, "0.0.17-nightly.20260415.1")).toEqual({
      serverExposureMode: "local-only",
      primaryBackendMode: "embedded",
      primaryEnvironmentId: null,
      updateChannel: "nightly",
      updateChannelConfiguredByUser: false,
    });
  });

  it("migrates legacy implicit stable settings to nightly when running a nightly build", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        serverExposureMode: "local-only",
        updateChannel: "latest",
      }),
      "utf8",
    );

    expect(readDesktopSettings(settingsPath, "0.0.17-nightly.20260415.1")).toEqual({
      serverExposureMode: "local-only",
      primaryBackendMode: "embedded",
      primaryEnvironmentId: null,
      updateChannel: "nightly",
      updateChannelConfiguredByUser: false,
    });
  });

  it("preserves an explicit stable choice on nightly builds", () => {
    const settingsPath = makeSettingsPath();
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        serverExposureMode: "local-only",
        updateChannel: "latest",
        updateChannelConfiguredByUser: true,
      }),
      "utf8",
    );

    expect(readDesktopSettings(settingsPath, "0.0.17-nightly.20260415.1")).toEqual({
      serverExposureMode: "local-only",
      primaryBackendMode: "embedded",
      primaryEnvironmentId: null,
      updateChannel: "latest",
      updateChannelConfiguredByUser: true,
    });
  });
});
