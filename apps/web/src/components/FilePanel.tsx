import { DiffsHighlighter, getSharedHighlighter, SupportedLanguages } from "@pierre/diffs";
import type { ProjectEntry } from "@t3tools/contracts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch, useParams } from "@tanstack/react-router";
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPrimaryEnvironmentConnection } from "../environments/runtime";
import { useTheme } from "../hooks/useTheme";
import { resolveDiffThemeName, type DiffThemeName } from "../lib/diffRendering";
import { cn } from "../lib/utils";
import { selectProjectByRef, useStore } from "../store";
import { createThreadSelectorByRef } from "../storeSelectors";
import { buildThreadRouteParams, resolveThreadRouteRef } from "../threadRoutes";
import { parseFileRouteSearch, stripFileSearchParams } from "../fileRouteSearch";
import { toastManager } from "./ui/toast";

// ─── Language detection ────────────────────────────────────────────────────

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "jsonc",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  mdx: "mdx",
  py: "python",
  go: "go",
  rs: "rust",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  env: "ini",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  rb: "ruby",
  php: "php",
  cs: "csharp",
  lua: "lua",
  vim: "viml",
  dockerfile: "dockerfile",
  tf: "hcl",
  hcl: "hcl",
};

function detectLanguage(path: string): string {
  const filename = path.split("/").pop() ?? "";
  const lower = filename.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === ".env" || lower.startsWith(".env.")) return "ini";
  const ext = lower.split(".").pop() ?? "";
  return EXT_TO_LANG[ext] ?? "text";
}

// ─── Syntax highlighting ───────────────────────────────────────────────────

const highlighterPromiseCache = new Map<string, Promise<DiffsHighlighter>>();

function getHighlighterPromise(language: string): Promise<DiffsHighlighter> {
  const cached = highlighterPromiseCache.get(language);
  if (cached) return cached;
  const promise = getSharedHighlighter({
    themes: [resolveDiffThemeName("dark"), resolveDiffThemeName("light")],
    langs: [language as SupportedLanguages],
    preferredHighlighter: "shiki-js",
  }).catch(() => {
    highlighterPromiseCache.delete(language);
    return getHighlighterPromise("text");
  });
  highlighterPromiseCache.set(language, promise);
  return promise;
}

function SuspenseHighlightedCode({
  code,
  language,
  themeName,
}: {
  code: string;
  language: string;
  themeName: DiffThemeName;
}) {
  const highlighter = use(getHighlighterPromise(language));
  const html = useMemo(() => {
    try {
      return highlighter.codeToHtml(code, { lang: language, theme: themeName });
    } catch {
      return highlighter.codeToHtml(code, { lang: "text", theme: themeName });
    }
  }, [code, highlighter, language, themeName]);
  return (
    <div
      className="file-panel-shiki text-xs leading-relaxed [&_pre]:m-0 [&_pre]:p-4 [&_pre]:font-mono [&_code]:font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function HighlightedCodeFallback({ code }: { code: string }) {
  return (
    <pre className="overflow-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-foreground/80">
      {code}
    </pre>
  );
}

// ─── File tree helpers ─────────────────────────────────────────────────────

function getPathDepth(path: string): number {
  return path.split("/").length - 1;
}

function sortEntries(entries: ProjectEntry[]): ProjectEntry[] {
  return [...entries].sort((a, b) => {
    const aDir = a.kind === "directory";
    const bDir = b.kind === "directory";
    const aParent = a.path.split("/").slice(0, -1).join("/");
    const bParent = b.path.split("/").slice(0, -1).join("/");
    if (aParent !== bParent) return a.path.localeCompare(b.path);
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
}

// ─── File tree entry row ───────────────────────────────────────────────────

function FileTreeRow({
  entry,
  isSelected,
  isExpanded,
  onSelect,
}: {
  entry: ProjectEntry;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (entry: ProjectEntry) => void;
}) {
  const depth = getPathDepth(entry.path);
  const name = entry.path.split("/").pop() ?? entry.path;
  const isDir = entry.kind === "directory";

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-1.5 py-[3px] text-left text-xs transition-colors",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "text-foreground/75 hover:bg-accent/50 hover:text-foreground",
      )}
      style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      onClick={() => onSelect(entry)}
      title={entry.path}
    >
      {isDir ? (
        isExpanded ? (
          <FolderOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )
      ) : (
        <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 truncate">{name}</span>
    </button>
  );
}

// ─── File content viewer/editor ────────────────────────────────────────────

function FileContentView({
  cwd,
  filePath,
}: {
  cwd: string;
  filePath: string;
}) {
  const { resolvedTheme } = useTheme();
  const themeName = resolveDiffThemeName(resolvedTheme);
  const language = detectLanguage(filePath);
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["file-content", cwd, filePath],
    queryFn: () =>
      getPrimaryEnvironmentConnection().client.projects.readFile({
        cwd,
        relativePath: filePath,
      }),
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (contents: string) =>
      getPrimaryEnvironmentConnection().client.projects.writeFile({
        cwd,
        relativePath: filePath,
        contents,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["file-content", cwd, filePath] });
      setIsEditing(false);
      toastManager.add({ title: "File saved", type: "success" });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to save file";
      toastManager.add({ title: msg, type: "error" });
    },
  });

  const handleEdit = useCallback(() => {
    setEditContent(data?.contents ?? "");
    setIsEditing(true);
  }, [data?.contents]);

  const handleSave = useCallback(() => {
    saveMutation.mutate(editContent);
  }, [editContent, saveMutation]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent("");
  }, []);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* File header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span
          className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/80"
          title={filePath}
        >
          {fileName}
        </span>
        <span className="shrink-0 rounded bg-accent/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {language}
        </span>
        {!isEditing ? (
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={handleEdit}
            title="Edit file"
            disabled={isLoading || !!error}
          >
            <PencilIcon className="size-3.5" />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-green-500 transition-colors hover:bg-accent"
              onClick={handleSave}
              title="Save"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <SaveIcon className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={handleCancel}
              title="Cancel"
            >
              <XIcon className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="p-4 text-xs text-destructive">
            {error instanceof Error ? error.message : "Failed to load file"}
          </div>
        ) : isEditing ? (
          <textarea
            ref={textareaRef}
            className="size-full resize-none border-none bg-transparent p-4 font-mono text-xs leading-relaxed text-foreground outline-none"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        ) : (
          <Suspense fallback={<HighlightedCodeFallback code={data?.contents ?? ""} />}>
            <SuspenseHighlightedCode
              code={data?.contents ?? ""}
              language={language}
              themeName={themeName}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Main FilePanel (pure content, no shell wrapper) ──────────────────────

export default function FilePanel() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const routeThreadRef = useParams({
    strict: false,
    select: (params) => resolveThreadRouteRef(params),
  });
  const fileSearch = useSearch({
    strict: false,
    select: (search) => parseFileRouteSearch(search),
  });
  const selectedPath = fileSearch.filesPath ?? null;

  const activeThread = useStore(
    useMemo(() => createThreadSelectorByRef(routeThreadRef), [routeThreadRef]),
  );
  const activeProjectId = activeThread?.projectId ?? null;
  const activeProject = useStore((store) =>
    activeThread && activeProjectId
      ? selectProjectByRef(store, {
          environmentId: activeThread.environmentId,
          projectId: activeProjectId,
        })
      : undefined,
  );
  const cwd = activeThread?.worktreePath ?? activeProject?.cwd ?? null;

  const { data: entriesResult, isLoading: isLoadingEntries } = useQuery({
    queryKey: ["file-entries", cwd, searchQuery],
    queryFn: () => {
      if (!cwd) throw new Error("No project directory");
      return getPrimaryEnvironmentConnection().client.projects.searchEntries({
        cwd,
        query: searchQuery.trim() || ".",
        limit: 200,
      });
    },
    enabled: !!cwd,
    staleTime: 10_000,
  });

  const allEntries = entriesResult?.entries ?? [];
  const sortedEntries = useMemo(() => sortEntries([...allEntries]), [allEntries]);

  const visibleEntries = useMemo(() => {
    if (searchQuery.trim()) return sortedEntries;
    return sortedEntries.filter((entry) => {
      if (!entry.parentPath) return true;
      return expandedDirs.has(entry.parentPath);
    });
  }, [sortedEntries, expandedDirs, searchQuery]);

  const selectEntry = useCallback(
    (entry: ProjectEntry) => {
      if (!routeThreadRef) return;
      if (entry.kind === "directory") {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          if (next.has(entry.path)) next.delete(entry.path);
          else next.add(entry.path);
          return next;
        });
        return;
      }
      void navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(routeThreadRef),
        search: (previous) => {
          const rest = stripFileSearchParams(previous);
          return { ...rest, files: "1", filesPath: entry.path };
        },
      });
    },
    [navigate, routeThreadRef],
  );

  if (!cwd) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        No project directory available.
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0">
      {/* File tree */}
      <div className="flex w-[220px] shrink-0 flex-col border-r border-border/50">
        <div className="shrink-0 border-b border-border/50 px-2 py-1.5">
          <input
            type="text"
            placeholder="Search files…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-border/60 bg-background/50 px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-border focus:bg-background"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {isLoadingEntries ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground/60">
              Loading…
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground/60">
              No files found
            </div>
          ) : (
            visibleEntries.map((entry) => (
              <FileTreeRow
                key={entry.path}
                entry={entry}
                isSelected={entry.path === selectedPath}
                isExpanded={expandedDirs.has(entry.path)}
                onSelect={selectEntry}
              />
            ))
          )}
          {entriesResult?.truncated && (
            <p className="px-3 pb-2 pt-1 text-[10px] text-muted-foreground/50">
              Results truncated — refine your search
            </p>
          )}
        </div>
      </div>

      {/* File content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedPath ? (
          <FileContentView key={selectedPath} cwd={cwd} filePath={selectedPath} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/60">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  );
}
