import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { Command } from "effect/unstable/cli";

import { NetService } from "@t3tools/shared/Net";
import { cli } from "./cli.ts";
import packageJson from "../package.json" with { type: "json" };

const runtime = ManagedRuntime.make(Layer.mergeAll(NodeServices.layer, NetService.layer));

const program = Effect.promise(() =>
  runtime.runPromise(Command.run(cli, { version: packageJson.version }).pipe(Effect.scoped)),
).pipe(Effect.ensuring(Effect.promise(() => runtime.dispose())));

NodeRuntime.runMain(program);
