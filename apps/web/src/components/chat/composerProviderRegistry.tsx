import {
  type ProviderKind,
  type ProviderModelOptions,
  type ScopedThreadRef,
  type ServerProviderModel,
} from "@t3tools/contracts";
import {
  getGeminiThinkingSelectionValue,
  isClaudeUltrathinkPrompt,
  resolveEffort,
} from "@t3tools/shared/model";
import type { ReactNode } from "react";
import type { DraftId } from "../../composerDraftStore";
import { getProviderModelCapabilities } from "../../providerModels";
import { shouldRenderTraitsControls, TraitsMenuContent, TraitsPicker } from "./TraitsPicker";
import {
  normalizeClaudeModelOptionsWithCapabilities,
  normalizeCodexModelOptionsWithCapabilities,
  normalizeGeminiModelOptionsWithCapabilities,
} from "@t3tools/shared/model";

export type ComposerProviderStateInput = {
  provider: ProviderKind;
  model: string;
  models: ReadonlyArray<ServerProviderModel>;
  prompt: string;
  modelOptions: ProviderModelOptions | null | undefined;
};

export type ComposerProviderState = {
  provider: ProviderKind;
  promptEffort: string | null;
  modelOptionsForDispatch: ProviderModelOptions[ProviderKind] | undefined;
  composerFrameClassName?: string;
  composerSurfaceClassName?: string;
  modelPickerIconClassName?: string;
};

type ProviderRegistryEntry = {
  getState: (input: ComposerProviderStateInput) => ComposerProviderState;
  renderTraitsMenuContent: (input: {
    threadRef?: ScopedThreadRef;
    draftId?: DraftId;
    model: string;
    models: ReadonlyArray<ServerProviderModel>;
    modelOptions: ProviderModelOptions[ProviderKind] | undefined;
    prompt: string;
    onPromptChange: (prompt: string) => void;
  }) => ReactNode;
  renderTraitsPicker: (input: {
    threadRef?: ScopedThreadRef;
    draftId?: DraftId;
    model: string;
    models: ReadonlyArray<ServerProviderModel>;
    modelOptions: ProviderModelOptions[ProviderKind] | undefined;
    prompt: string;
    onPromptChange: (prompt: string) => void;
  }) => ReactNode;
};

function hasComposerTraitsTarget(input: {
  threadRef: ScopedThreadRef | undefined;
  draftId: DraftId | undefined;
}): boolean {
  return input.threadRef !== undefined || input.draftId !== undefined;
}

function shouldRenderComposerTraits(input: {
  provider: ProviderKind;
  model: string;
  models: ReadonlyArray<ServerProviderModel>;
  modelOptions: ProviderModelOptions[ProviderKind] | undefined;
  prompt: string;
}): boolean {
  return shouldRenderTraitsControls({
    provider: input.provider,
    model: input.model,
    models: input.models,
    modelOptions: input.modelOptions,
    prompt: input.prompt,
  });
}

function getProviderStateFromCapabilities(
  input: ComposerProviderStateInput,
): ComposerProviderState {
  const { provider, model, models, prompt, modelOptions } = input;
  const caps = getProviderModelCapabilities(models, model, provider);
  const providerOptions = modelOptions?.[provider];

  // Resolve effort
  const rawEffort = providerOptions
    ? provider === "gemini"
      ? getGeminiThinkingSelectionValue(caps, modelOptions?.gemini)
      : "effort" in providerOptions
        ? providerOptions.effort
        : "reasoningEffort" in providerOptions
          ? providerOptions.reasoningEffort
          : null
    : null;

  const promptEffort = resolveEffort(caps, rawEffort) ?? null;

  // Normalize options for dispatch
  const normalizedOptions =
    provider === "codex"
      ? normalizeCodexModelOptionsWithCapabilities(caps, modelOptions?.codex)
      : provider === "claudeAgent"
        ? normalizeClaudeModelOptionsWithCapabilities(caps, modelOptions?.claudeAgent)
        : normalizeGeminiModelOptionsWithCapabilities(caps, modelOptions?.gemini);

  // Ultrathink styling (driven by capabilities data, not provider identity)
  const ultrathinkActive =
    caps.promptInjectedEffortLevels.length > 0 && isClaudeUltrathinkPrompt(prompt);

  return {
    provider,
    promptEffort,
    modelOptionsForDispatch: normalizedOptions,
    ...(ultrathinkActive ? { composerFrameClassName: "ultrathink-frame" } : {}),
    ...(ultrathinkActive
      ? { composerSurfaceClassName: "shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]" }
      : {}),
    ...(ultrathinkActive ? { modelPickerIconClassName: "ultrathink-chroma" } : {}),
  };
}

function makeProviderRegistryEntry(provider: ProviderKind): ProviderRegistryEntry {
  return {
    getState: (input) => getProviderStateFromCapabilities(input),
    renderTraitsMenuContent: ({
      threadRef,
      draftId,
      model,
      models,
      modelOptions,
      prompt,
      onPromptChange,
    }) =>
      !hasComposerTraitsTarget({ threadRef, draftId }) ||
      !shouldRenderComposerTraits({
        provider,
        model,
        models,
        modelOptions,
        prompt,
      }) ? null : (
        <TraitsMenuContent
          provider={provider}
          models={models}
          {...(threadRef ? { threadRef } : {})}
          {...(draftId ? { draftId } : {})}
          model={model}
          modelOptions={modelOptions}
          prompt={prompt}
          onPromptChange={onPromptChange}
        />
      ),
    renderTraitsPicker: ({
      threadRef,
      draftId,
      model,
      models,
      modelOptions,
      prompt,
      onPromptChange,
    }) =>
      !hasComposerTraitsTarget({ threadRef, draftId }) ||
      !shouldRenderComposerTraits({
        provider,
        model,
        models,
        modelOptions,
        prompt,
      }) ? null : (
        <TraitsPicker
          provider={provider}
          models={models}
          {...(threadRef ? { threadRef } : {})}
          {...(draftId ? { draftId } : {})}
          model={model}
          modelOptions={modelOptions}
          prompt={prompt}
          onPromptChange={onPromptChange}
        />
      ),
  };
}

const composerProviderRegistry: Record<ProviderKind, ProviderRegistryEntry> = {
  codex: makeProviderRegistryEntry("codex"),
  claudeAgent: makeProviderRegistryEntry("claudeAgent"),
  gemini: makeProviderRegistryEntry("gemini"),
};

export function getComposerProviderState(input: ComposerProviderStateInput): ComposerProviderState {
  return composerProviderRegistry[input.provider].getState(input);
}

export function renderProviderTraitsMenuContent(input: {
  provider: ProviderKind;
  threadRef?: ScopedThreadRef;
  draftId?: DraftId;
  model: string;
  models: ReadonlyArray<ServerProviderModel>;
  modelOptions: ProviderModelOptions[ProviderKind] | undefined;
  prompt: string;
  onPromptChange: (prompt: string) => void;
}): ReactNode {
  return composerProviderRegistry[input.provider].renderTraitsMenuContent({
    ...(input.threadRef ? { threadRef: input.threadRef } : {}),
    ...(input.draftId ? { draftId: input.draftId } : {}),
    model: input.model,
    models: input.models,
    modelOptions: input.modelOptions,
    prompt: input.prompt,
    onPromptChange: input.onPromptChange,
  });
}

export function renderProviderTraitsPicker(input: {
  provider: ProviderKind;
  threadRef?: ScopedThreadRef;
  draftId?: DraftId;
  model: string;
  models: ReadonlyArray<ServerProviderModel>;
  modelOptions: ProviderModelOptions[ProviderKind] | undefined;
  prompt: string;
  onPromptChange: (prompt: string) => void;
}): ReactNode {
  return composerProviderRegistry[input.provider].renderTraitsPicker({
    ...(input.threadRef ? { threadRef: input.threadRef } : {}),
    ...(input.draftId ? { draftId: input.draftId } : {}),
    model: input.model,
    models: input.models,
    modelOptions: input.modelOptions,
    prompt: input.prompt,
    onPromptChange: input.onPromptChange,
  });
}
