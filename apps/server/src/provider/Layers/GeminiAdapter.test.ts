import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { ProviderRuntimeEvent, ThreadId, type ServerProvider } from "@t3tools/contracts";
import { Effect, Layer, Ref, Stream } from "effect";
import { afterAll, describe, expect, it } from "vitest";

import { ServerConfig } from "../../config.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { GeminiAdapter } from "../Services/GeminiAdapter.ts";
import { ProviderRegistry } from "../Services/ProviderRegistry.ts";
import {
  buildGeminiThinkingModelConfigAliases,
  geminiRequestTimeoutMs,
  makeGeminiAdapterLive,
  resolveStartedGeminiSessionId,
} from "./GeminiAdapter.ts";

const tempDirs: Array<string> = [];

afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeFakeGeminiBinary(): {
  readonly baseDir: string;
  readonly binaryPath: string;
  readonly cwd: string;
} {
  const baseDir = makeTempDir("gemini-adapter-test-");
  const binaryPath = path.join(baseDir, "fake-gemini-acp.js");

  writeFileSync(
    binaryPath,
    `#!/usr/bin/env node
const readline = require("node:readline");

let sessionCounter = 0;

const reply = (id, result) => {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
};

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  const message = JSON.parse(trimmed);

  switch (message.method) {
    case "initialize":
      reply(message.id, {});
      return;
    case "session/new":
      sessionCounter += 1;
      reply(message.id, {
        sessionId: "session-" + process.pid + "-" + sessionCounter,
      });
      return;
    case "session/set_mode":
    case "session/set_model":
    case "session/prompt":
      reply(
        message.id,
        message.method === "session/prompt" ? { stopReason: "completed" } : {},
      );
      return;
    default:
      reply(message.id, {});
  }
});

process.on("SIGTERM", () => {
  setTimeout(() => process.exit(1), 75);
});
`,
    "utf8",
  );
  chmodSync(binaryPath, 0o755);

  return {
    baseDir,
    binaryPath,
    cwd: baseDir,
  };
}

function makeProviderRegistryLayer(providers: ReadonlyArray<ServerProvider> = []) {
  return Layer.succeed(ProviderRegistry, {
    getProviders: Effect.succeed(providers),
    refresh: () => Effect.succeed(providers),
    streamChanges: Stream.empty,
  });
}

function makeHarness() {
  const fakeBinary = writeFakeGeminiBinary();

  return makeGeminiAdapterLive().pipe(
    Layer.provideMerge(ServerConfig.layerTest(fakeBinary.cwd, fakeBinary.baseDir)),
    Layer.provideMerge(
      ServerSettingsService.layerTest({
        providers: {
          gemini: {
            binaryPath: fakeBinary.binaryPath,
          },
        },
      }),
    ),
    Layer.provideMerge(makeProviderRegistryLayer()),
    Layer.provideMerge(NodeServices.layer),
  );
}

describe("resolveStartedGeminiSessionId", () => {
  it("prefers the actual session id returned by Gemini over the requested resume id", () => {
    expect(
      resolveStartedGeminiSessionId("stale-session-id", {
        sessionId: "fresh-session-id",
      }),
    ).toBe("fresh-session-id");
  });

  it("falls back to the requested resume id when the load response omits sessionId", () => {
    expect(resolveStartedGeminiSessionId("resume-session-id", {})).toBe("resume-session-id");
  });

  it("returns the started session id for fresh sessions", () => {
    expect(resolveStartedGeminiSessionId(undefined, { sessionId: "new-session-id" })).toBe(
      "new-session-id",
    );
  });

  it("returns undefined when neither a requested nor started session id is available", () => {
    expect(resolveStartedGeminiSessionId(undefined, {})).toBeUndefined();
  });
});

describe("geminiRequestTimeoutMs", () => {
  it("uses the short ACP timeout for control-plane requests", () => {
    expect(geminiRequestTimeoutMs("session/new")).toBe(60_000);
    expect(geminiRequestTimeoutMs("session/set_model")).toBe(60_000);
  });

  it("uses a long timeout for session/prompt turns", () => {
    expect(geminiRequestTimeoutMs("session/prompt")).toBe(30 * 60_000);
  });
});

describe("buildGeminiThinkingModelConfigAliases", () => {
  it("builds Gemini 3 and Gemini 2.5 aliases from model families", () => {
    expect(
      buildGeminiThinkingModelConfigAliases(["auto-gemini-3", "gemini-2.5-flash", "custom-model"]),
    ).toMatchObject({
      "t3code-gemini-auto-gemini-3-thinking-level-high": {
        extends: "chat-base-3",
        modelConfig: {
          model: "auto-gemini-3",
          generateContentConfig: {
            thinkingConfig: {
              thinkingLevel: "HIGH",
            },
          },
        },
      },
      "t3code-gemini-auto-gemini-3-thinking-level-low": {
        extends: "chat-base-3",
        modelConfig: {
          model: "auto-gemini-3",
          generateContentConfig: {
            thinkingConfig: {
              thinkingLevel: "LOW",
            },
          },
        },
      },
      "t3code-gemini-gemini-2-5-flash-thinking-budget-dynamic": {
        extends: "chat-base-2.5",
        modelConfig: {
          model: "gemini-2.5-flash",
          generateContentConfig: {
            thinkingConfig: {
              thinkingBudget: -1,
            },
          },
        },
      },
      "t3code-gemini-gemini-2-5-flash-thinking-budget-512": {
        extends: "chat-base-2.5",
        modelConfig: {
          model: "gemini-2.5-flash",
          generateContentConfig: {
            thinkingConfig: {
              thinkingBudget: 512,
            },
          },
        },
      },
      "t3code-gemini-gemini-2-5-flash-thinking-budget-0": {
        extends: "chat-base-2.5",
        modelConfig: {
          model: "gemini-2.5-flash",
          generateContentConfig: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        },
      },
    });
  });
});

describe("GeminiAdapterLive", () => {
  it("does not emit stale exit events when startSession replaces an existing session", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const adapter = yield* GeminiAdapter;
          const eventsRef = yield* Ref.make<Array<ProviderRuntimeEvent>>([]);

          yield* Stream.runForEach(adapter.streamEvents, (event) =>
            Ref.update(eventsRef, (events) => [...events, event]),
          ).pipe(Effect.forkScoped);

          const threadId = ThreadId.make("thread-gemini-stale-exit");

          yield* adapter.startSession({
            provider: "gemini",
            threadId,
            runtimeMode: "full-access",
          });
          yield* adapter.startSession({
            provider: "gemini",
            threadId,
            runtimeMode: "full-access",
          });

          yield* Effect.sleep("250 millis");

          const events = yield* Ref.get(eventsRef);
          assert.equal(
            events.some((event) => event.type === "runtime.error"),
            false,
            "replaced sessions should not emit stale runtime.error events",
          );
          assert.equal(
            events.some((event) => event.type === "session.exited"),
            false,
            "replaced sessions should not emit stale session.exited events",
          );
        }).pipe(Effect.provide(makeHarness())),
      ),
    );
  });
});
