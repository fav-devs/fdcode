import { Context } from "effect";

import type { ServerProviderShape } from "./ServerProvider";

export interface GeminiProviderShape extends ServerProviderShape {}

export class GeminiProvider extends Context.Service<GeminiProvider, GeminiProviderShape>()(
  "t3/provider/Services/GeminiProvider",
) {}
