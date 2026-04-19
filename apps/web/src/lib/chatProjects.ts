import type { ProjectId } from "@t3tools/contracts";

import { readEnvironmentApi } from "../environmentApi";
import { selectProjectsAcrossEnvironments, useStore } from "../store";
import type { Project } from "../types";
import { newCommandId, newProjectId } from "./utils";

const pendingHomeChatCreationByHomeDir = new Map<string, Promise<ProjectId | null>>();
const pendingHomeChatFixupByHomeDir = new Map<string, Promise<void>>();

export function findHomeChatContainerProject<T extends Pick<Project, "cwd" | "kind" | "name">>(
  projects: readonly T[],
  homeDir: string | null | undefined,
): T | null {
  if (!homeDir) {
    return null;
  }
  return projects.find((project) => isHomeChatContainerProject(project, homeDir)) ?? null;
}

function findCanonicalHomeProject(homeDir: string): {
  canonicalProjectId: ProjectId | null;
  duplicateProjectIds: ProjectId[];
  needsKindFixup: boolean;
} {
  const state = useStore.getState();
  const projects = selectProjectsAcrossEnvironments(state);
  const homeProjects = projects.filter((project) => isHomeChatContainerProject(project, homeDir));
  const canonicalProject =
    homeProjects.find((project) => project.kind === "chat") ?? homeProjects[0];
  if (!canonicalProject) {
    return { canonicalProjectId: null, duplicateProjectIds: [], needsKindFixup: false };
  }

  const threadIdsByProjectId = Object.values(state.environmentStateById).reduce(
    (acc, env) => {
      for (const [projectId, threadIds] of Object.entries(env.threadIdsByProjectId)) {
        acc[projectId] = [...(acc[projectId] ?? []), ...threadIds];
      }
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const duplicateProjectIds = homeProjects
    .filter((project) => project.id !== canonicalProject.id)
    .flatMap((project) => {
      const hasThreads = (threadIdsByProjectId[project.id]?.length ?? 0) > 0;
      return hasThreads ? [] : [project.id];
    });

  return {
    canonicalProjectId: canonicalProject.id,
    duplicateProjectIds,
    needsKindFixup: canonicalProject.kind !== "chat",
  };
}

async function fixupHomeChatProject(homeDir: string, environmentId: string): Promise<void> {
  const api = readEnvironmentApi(environmentId as never);
  if (!api) return;

  const { canonicalProjectId, duplicateProjectIds, needsKindFixup } =
    findCanonicalHomeProject(homeDir);
  if (!canonicalProjectId) return;

  if (needsKindFixup) {
    await api.orchestration.dispatchCommand({
      type: "project.meta.update",
      commandId: newCommandId(),
      projectId: canonicalProjectId,
      kind: "chat",
      title: "Home",
      workspaceRoot: homeDir,
    });
  }

  for (const duplicateProjectId of duplicateProjectIds) {
    await api.orchestration.dispatchCommand({
      type: "project.delete",
      commandId: newCommandId(),
      projectId: duplicateProjectId,
    });
  }
}

function scheduleHomeChatFixup(homeDir: string, environmentId: string): void {
  if (pendingHomeChatFixupByHomeDir.has(homeDir)) return;
  const promise = fixupHomeChatProject(homeDir, environmentId).finally(() => {
    pendingHomeChatFixupByHomeDir.delete(homeDir);
  });
  pendingHomeChatFixupByHomeDir.set(homeDir, promise);
}

export async function ensureHomeChatProject(
  homeDir: string,
  environmentId: string,
): Promise<ProjectId | null> {
  const api = readEnvironmentApi(environmentId as never);
  if (!api) return null;

  const { canonicalProjectId } = findCanonicalHomeProject(homeDir);
  if (canonicalProjectId) {
    scheduleHomeChatFixup(homeDir, environmentId);
    return canonicalProjectId;
  }

  const pendingCreation = pendingHomeChatCreationByHomeDir.get(homeDir);
  if (pendingCreation) return pendingCreation;

  const creationPromise = (async () => {
    const projectId = newProjectId();
    await api.orchestration.dispatchCommand({
      type: "project.create",
      commandId: newCommandId(),
      projectId,
      kind: "chat",
      title: "Home",
      workspaceRoot: homeDir,
      createdAt: new Date().toISOString(),
    });
    return projectId;
  })().finally(() => {
    pendingHomeChatCreationByHomeDir.delete(homeDir);
  });

  pendingHomeChatCreationByHomeDir.set(homeDir, creationPromise);
  return creationPromise;
}

export function prewarmHomeChatProject(homeDir: string, environmentId: string): void {
  void ensureHomeChatProject(homeDir, environmentId);
}

export function isHomeChatContainerProject(
  project: Pick<Project, "cwd" | "kind" | "name"> | null | undefined,
  homeDir: string | null | undefined,
): boolean {
  if (!project || !homeDir) return false;
  return project.cwd === homeDir && (project.kind === "chat" || project.name === "Home");
}
