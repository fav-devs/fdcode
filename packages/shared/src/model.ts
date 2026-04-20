import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_SLUG_ALIASES_BY_PROVIDER,
  type ClaudeAgentEffort,
  type ClaudeModelOptions,
  type CodexModelOptions,
  type CursorModelOptions,
  type GeminiThinkingBudget,
  type GeminiThinkingLevel,
  type GeminiModelOptions,
  type ModelCapabilities,
  type ModelSelection,
  type OpenCodeModelOptions,
  type ProviderKind,
  type ProviderModelOptions,
} from "@t3tools/contracts";

export interface SelectableModelOption {
  slug: string;
  name: string;
}

export type GeminiThinkingConfigKind = "budget" | "level";

const GEMINI_3_MODEL_PATTERN = /^(?:auto-)?gemini-3(?:[.-]|$)/i;
const GEMINI_2_5_MODEL_PATTERN = /^(?:auto-)?gemini-2\.5(?:[.-]|$)/i;
const GEMINI_THINKING_LEVEL_SET = new Set<GeminiThinkingLevel>(["LOW", "HIGH"]);
const GEMINI_THINKING_BUDGET_MAP = new Map<string, GeminiThinkingBudget>([
  ["-1", -1],
  ["0", 0],
  ["512", 512],
]);

export const EMPTY_MODEL_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

export const DEFAULT_GEMINI_MODEL_CAPABILITIES: ModelCapabilities = EMPTY_MODEL_CAPABILITIES;

export const GEMINI_3_MODEL_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "HIGH", label: "High", isDefault: true },
    { value: "LOW", label: "Low" },
  ],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

export const GEMINI_2_5_MODEL_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "-1", label: "Dynamic", isDefault: true },
    { value: "512", label: "512 Tokens" },
  ],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

function isGeminiThinkingLevel(value: string): value is GeminiThinkingLevel {
  return GEMINI_THINKING_LEVEL_SET.has(value as GeminiThinkingLevel);
}

function isGeminiThinkingBudget(value: string): value is `${GeminiThinkingBudget}` {
  return GEMINI_THINKING_BUDGET_MAP.has(value);
}

function sanitizeGeminiAliasSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "model";
}

export function getGeminiThinkingConfigKind(
  model: string | null | undefined,
): GeminiThinkingConfigKind | null {
  const trimmed = trimOrNull(model);
  if (!trimmed) {
    return null;
  }
  if (GEMINI_3_MODEL_PATTERN.test(trimmed)) {
    return "level";
  }
  if (GEMINI_2_5_MODEL_PATTERN.test(trimmed)) {
    return "budget";
  }
  return null;
}

export function geminiCapabilitiesForModel(
  modelId: string | null | undefined,
  fallbackCapabilities: ModelCapabilities = DEFAULT_GEMINI_MODEL_CAPABILITIES,
): ModelCapabilities {
  const trimmed = trimOrNull(modelId)?.toLowerCase();
  switch (getGeminiThinkingConfigKind(modelId)) {
    case "level":
      return GEMINI_3_MODEL_CAPABILITIES;
    case "budget":
      if (!trimmed) {
        return fallbackCapabilities;
      }
      return GEMINI_2_5_MODEL_CAPABILITIES;
    default:
      return fallbackCapabilities;
  }
}

export function getGeminiThinkingSelectionValue(
  caps: ModelCapabilities,
  modelOptions: GeminiModelOptions | null | undefined,
): string | null {
  const candidates = [
    trimOrNull(modelOptions?.thinkingLevel),
    modelOptions?.thinkingBudget !== undefined ? String(modelOptions.thinkingBudget) : null,
  ];

  return (
    candidates.find(
      (candidate): candidate is string => !!candidate && hasEffortLevel(caps, candidate),
    ) ??
    candidates.find((candidate): candidate is string => !!candidate) ??
    null
  );
}

export function geminiModelOptionsFromEffortValue(
  value: string | null | undefined,
): GeminiModelOptions | undefined {
  const trimmed = trimOrNull(value);
  if (!trimmed) {
    return undefined;
  }
  if (isGeminiThinkingLevel(trimmed)) {
    return { thinkingLevel: trimmed };
  }
  if (isGeminiThinkingBudget(trimmed)) {
    return {
      thinkingBudget: GEMINI_THINKING_BUDGET_MAP.get(trimmed) as GeminiThinkingBudget,
    };
  }
  return undefined;
}

export function mergeGeminiModelOptions(
  modelOptions: GeminiModelOptions | null | undefined,
  patch: GeminiModelOptions,
): GeminiModelOptions {
  if (patch.thinkingLevel !== undefined) {
    const { thinkingBudget: _thinkingBudget, ...rest } = modelOptions ?? {};
    return { ...rest, ...patch };
  }
  if (patch.thinkingBudget !== undefined) {
    const { thinkingLevel: _thinkingLevel, ...rest } = modelOptions ?? {};
    return { ...rest, ...patch };
  }

  return { ...modelOptions, ...patch };
}

export function getGeminiThinkingModelAlias(
  model: string,
  modelOptions: GeminiModelOptions | null | undefined,
): string | null {
  const kind = getGeminiThinkingConfigKind(model);
  if (!kind || !modelOptions) {
    return null;
  }

  const caps = geminiCapabilitiesForModel(model);
  const effort = getGeminiThinkingSelectionValue(caps, modelOptions);
  if (!effort || !hasEffortLevel(caps, effort)) {
    return null;
  }

  const nextOptions = geminiModelOptionsFromEffortValue(effort);
  if (!nextOptions) {
    return null;
  }

  const base = sanitizeGeminiAliasSegment(model);
  if (kind === "level" && nextOptions.thinkingLevel) {
    return `t3code-gemini-${base}-thinking-level-${nextOptions.thinkingLevel.toLowerCase()}`;
  }
  if (kind === "budget" && nextOptions.thinkingBudget !== undefined) {
    const budget =
      nextOptions.thinkingBudget === -1 ? "dynamic" : String(nextOptions.thinkingBudget);
    return `t3code-gemini-${base}-thinking-budget-${budget}`;
  }
  return null;
}

export function resolveGeminiApiModelId(
  model: string,
  modelOptions: GeminiModelOptions | null | undefined,
): string {
  return getGeminiThinkingModelAlias(model, modelOptions) ?? model;
}

/** Check whether a capabilities object includes a given effort value. */
export function hasEffortLevel(caps: ModelCapabilities, value: string): boolean {
  return caps.reasoningEffortLevels.some((l) => l.value === value);
}

/** Return the default effort value for a capabilities object, or null if none. */
export function getDefaultEffort(caps: ModelCapabilities): string | null {
  return caps.reasoningEffortLevels.find((l) => l.isDefault)?.value ?? null;
}

/**
 * Resolve a raw effort option against capabilities.
 *
 * Returns the explicit supported value when present and not prompt-injected,
 * otherwise the model default. Returns `undefined` when the model exposes no
 * effort levels.
 */
export function resolveEffort(
  caps: ModelCapabilities,
  raw: string | null | undefined,
): string | undefined {
  const defaultValue = getDefaultEffort(caps);
  const trimmed = typeof raw === "string" ? raw.trim() : null;
  if (
    trimmed &&
    !caps.promptInjectedEffortLevels.includes(trimmed) &&
    hasEffortLevel(caps, trimmed)
  ) {
    return trimmed;
  }
  return defaultValue ?? undefined;
}

/** Check whether a capabilities object includes a given context window value. */
export function hasContextWindowOption(caps: ModelCapabilities, value: string): boolean {
  return caps.contextWindowOptions.some((o) => o.value === value);
}

/** Return the default context window value, or `null` if none is defined. */
export function getDefaultContextWindow(caps: ModelCapabilities): string | null {
  return caps.contextWindowOptions.find((o) => o.isDefault)?.value ?? null;
}

/**
 * Resolve a raw `contextWindow` option against capabilities.
 *
 * Returns the explicit supported value when present, otherwise the model
 * default. Returns `undefined` when the model exposes no context window options.
 */
export function resolveContextWindow(
  caps: ModelCapabilities,
  raw: string | null | undefined,
): string | undefined {
  const defaultValue = getDefaultContextWindow(caps);
  if (!raw) return defaultValue ?? undefined;
  return hasContextWindowOption(caps, raw) ? raw : (defaultValue ?? undefined);
}

export function normalizeCodexModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: CodexModelOptions | null | undefined,
): CodexModelOptions | undefined {
  const reasoningEffort = resolveEffort(caps, modelOptions?.reasoningEffort);
  const fastMode = caps.supportsFastMode ? modelOptions?.fastMode : undefined;
  const nextOptions: CodexModelOptions = {
    ...(reasoningEffort
      ? { reasoningEffort: reasoningEffort as CodexModelOptions["reasoningEffort"] }
      : {}),
    ...(fastMode !== undefined ? { fastMode } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeClaudeModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: ClaudeModelOptions | null | undefined,
): ClaudeModelOptions | undefined {
  const effort = resolveEffort(caps, modelOptions?.effort);
  const thinking = caps.supportsThinkingToggle ? modelOptions?.thinking : undefined;
  const fastMode = caps.supportsFastMode ? modelOptions?.fastMode : undefined;
  const contextWindow = resolveContextWindow(caps, modelOptions?.contextWindow);
  const nextOptions: ClaudeModelOptions = {
    ...(thinking !== undefined ? { thinking } : {}),
    ...(effort ? { effort: effort as ClaudeModelOptions["effort"] } : {}),
    ...(fastMode !== undefined ? { fastMode } : {}),
    ...(contextWindow !== undefined ? { contextWindow } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeCursorModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: CursorModelOptions | null | undefined,
): CursorModelOptions | undefined {
  const reasoning = resolveEffort(caps, modelOptions?.reasoning);
  const thinking = caps.supportsThinkingToggle ? modelOptions?.thinking : undefined;
  const fastMode = caps.supportsFastMode ? modelOptions?.fastMode : undefined;
  const contextWindow = resolveContextWindow(caps, modelOptions?.contextWindow);
  const nextOptions: CursorModelOptions = {
    ...(reasoning ? { reasoning: reasoning as CursorModelOptions["reasoning"] } : {}),
    ...(fastMode !== undefined ? { fastMode } : {}),
    ...(thinking !== undefined ? { thinking } : {}),
    ...(contextWindow !== undefined ? { contextWindow } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeGeminiModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: GeminiModelOptions | null | undefined,
): GeminiModelOptions | undefined {
  const effort = resolveEffort(caps, getGeminiThinkingSelectionValue(caps, modelOptions));
  return geminiModelOptionsFromEffortValue(effort);
}

function resolveLabeledOption(
  options: ReadonlyArray<{ value: string; isDefault?: boolean | undefined }> | undefined,
  raw: string | null | undefined,
): string | undefined {
  if (!options || options.length === 0) {
    return raw ?? undefined;
  }
  if (raw && options.some((option) => option.value === raw)) {
    return raw;
  }
  return options.find((option) => option.isDefault)?.value ?? options[0]?.value;
}

export function normalizeOpenCodeModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: OpenCodeModelOptions | null | undefined,
): OpenCodeModelOptions | undefined {
  const variant = resolveLabeledOption(caps.variantOptions, trimOrNull(modelOptions?.variant));
  const agent = resolveLabeledOption(caps.agentOptions, trimOrNull(modelOptions?.agent));
  const nextOptions: OpenCodeModelOptions = {
    ...(variant ? { variant } : {}),
    ...(agent ? { agent } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeProviderModelOptionsWithCapabilities(
  provider: ProviderKind,
  caps: ModelCapabilities,
  modelOptions: ProviderModelOptions[ProviderKind] | null | undefined,
): ProviderModelOptions[ProviderKind] | undefined {
  switch (provider) {
    case "codex":
      return normalizeCodexModelOptionsWithCapabilities(caps, modelOptions as CodexModelOptions);
    case "claudeAgent":
      return normalizeClaudeModelOptionsWithCapabilities(caps, modelOptions as ClaudeModelOptions);
    case "cursor":
      return normalizeCursorModelOptionsWithCapabilities(caps, modelOptions as CursorModelOptions);
    case "gemini":
      return normalizeGeminiModelOptionsWithCapabilities(caps, modelOptions as GeminiModelOptions);
    case "opencode":
      return normalizeOpenCodeModelOptionsWithCapabilities(
        caps,
        modelOptions as OpenCodeModelOptions,
      );
  }
}

export function isClaudeUltrathinkPrompt(text: string | null | undefined): boolean {
  return typeof text === "string" && /\bultrathink\b/i.test(text);
}

export function normalizeModelSlug(
  model: string | null | undefined,
  provider: ProviderKind = "codex",
): string | null {
  if (typeof model !== "string") {
    return null;
  }

  const trimmed = model.trim();
  if (!trimmed) {
    return null;
  }

  const aliases = MODEL_SLUG_ALIASES_BY_PROVIDER[provider] as Record<string, string>;
  const aliased = Object.prototype.hasOwnProperty.call(aliases, trimmed)
    ? aliases[trimmed]
    : undefined;
  return typeof aliased === "string" ? aliased : trimmed;
}

export function resolveSelectableModel(
  provider: ProviderKind,
  value: string | null | undefined,
  options: ReadonlyArray<SelectableModelOption>,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = options.find((option) => option.slug === trimmed);
  if (direct) {
    return direct.slug;
  }

  const byName = options.find((option) => option.name.toLowerCase() === trimmed.toLowerCase());
  if (byName) {
    return byName.slug;
  }

  const normalized = normalizeModelSlug(trimmed, provider);
  if (!normalized) {
    return null;
  }

  const resolved = options.find((option) => option.slug === normalized);
  return resolved ? resolved.slug : null;
}

function resolveModelSlug(model: string | null | undefined, provider: ProviderKind): string {
  const normalized = normalizeModelSlug(model, provider);
  if (!normalized) {
    return DEFAULT_MODEL_BY_PROVIDER[provider];
  }
  return normalized;
}

export function resolveModelSlugForProvider(
  provider: ProviderKind,
  model: string | null | undefined,
): string {
  return resolveModelSlug(model, provider);
}

/** Trim a string, returning null for empty/missing values. */
export function trimOrNull<T extends string>(value: T | null | undefined): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim() as T;
  return trimmed || null;
}

export function createModelSelection(
  provider: ProviderKind,
  model: string,
  options?: ProviderModelOptions[ProviderKind] | undefined,
): ModelSelection {
  switch (provider) {
    case "codex":
      return {
        provider,
        model,
        ...(options ? { options: options as CodexModelOptions } : {}),
      };
    case "claudeAgent":
      return {
        provider,
        model,
        ...(options ? { options: options as ClaudeModelOptions } : {}),
      };
    case "cursor":
      return {
        provider,
        model,
        ...(options ? { options: options as CursorModelOptions } : {}),
      };
    case "gemini":
      return {
        provider,
        model,
        ...(options ? { options: options as GeminiModelOptions } : {}),
      };
    case "opencode":
      return {
        provider,
        model,
        ...(options ? { options: options as OpenCodeModelOptions } : {}),
      };
  }
}

export function resolveApiModelId(modelSelection: ModelSelection): string {
  switch (modelSelection.provider) {
    case "claudeAgent": {
      switch (modelSelection.options?.contextWindow) {
        case "1m":
          return `${modelSelection.model}[1m]`;
        default:
          return modelSelection.model;
      }
    }
    case "gemini": {
      return resolveGeminiApiModelId(modelSelection.model, modelSelection.options);
    }
    default: {
      return modelSelection.model;
    }
  }
}

export function applyClaudePromptEffortPrefix(
  text: string,
  effort: ClaudeAgentEffort | null | undefined,
): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (effort !== "ultrathink") {
    return trimmed;
  }
  if (trimmed.startsWith("Ultrathink:")) {
    return trimmed;
  }
  return `Ultrathink:\n${trimmed}`;
}
