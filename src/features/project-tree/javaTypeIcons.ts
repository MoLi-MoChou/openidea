/**
 * Lightweight Java/Kotlin type icons for the Project view: a small content sniff
 * (IDEA's PsiBasedFileIconProvider / IconProvider) cached after a folder loads.
 * Spring stereotype annotations reuse the existing Spring Boot glyph (no Ultimate
 * stereotype assets in the open-source icon set).
 */
import { create } from "zustand";
import { call, commands, isTauri } from "@/platform/ipc";

export type JavaTypeKind = "class" | "class-abstract" | "interface" | "enum" | "record" | "annotation";

export interface JavaTypeInfo {
  kind: JavaTypeKind;
  /** Spring stereotype / Boot application annotation present on the type. */
  spring?: boolean;
}

const SPRING_ANN =
  /@(?:SpringBootApplication|RestController|Controller|Service|Repository|Component|Configuration|ControllerAdvice|RestControllerAdvice)\b/;

/** Strip // and /* *\/ comments; keep newlines so line structure survives. */
export function stripJavaNoise(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  while (i < n) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? n : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '"' && src.startsWith('"""', i)) {
      const end = src.indexOf('"""', i + 3);
      const stop = end < 0 ? n : end + 3;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      const stop = Math.min(n, j + 1);
      out += blank(src.slice(i, stop));
      i = stop;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const TYPE_RE =
  /(?:^|[^.\w])(?:(?:public|protected|private|internal|open|final|sealed|non-sealed|static|strictfp|data|value|inner)\s+)*(abstract\s+)?(@?interface|enum\s+class|enum|record|annotation\s+class|class)\s+([A-Za-z_$][\w$]*)/;

/**
 * Primary type kind of a Java / Kotlin source (first top-level type).
 * `null` when the snippet has no type declaration.
 */
export function sniffJavaTypeKind(src: string): JavaTypeInfo | null {
  const code = stripJavaNoise(src.slice(0, 12_000));
  const m = TYPE_RE.exec(code);
  if (!m) return null;
  const abstractKw = !!m[1];
  const raw = m[2]!;
  let kind: JavaTypeKind;
  if (raw === "interface" || raw === "@interface") kind = raw === "@interface" ? "annotation" : "interface";
  else if (raw === "enum" || raw === "enum class") kind = "enum";
  else if (raw === "record") kind = "record";
  else if (raw === "annotation class") kind = "annotation";
  else kind = abstractKw ? "class-abstract" : "class";
  // Annotations attached to the type sit in the slice before the match.
  const head = code.slice(Math.max(0, m.index - 800), m.index);
  const spring = SPRING_ANN.test(head) || SPRING_ANN.test(code.slice(0, 2000));
  return spring ? { kind, spring: true } : { kind };
}

/** Project-view icon name for a sniffed type. */
export function javaTypeIconName(info: JavaTypeInfo): string {
  if (info.spring) return "spring-boot";
  return info.kind;
}

interface JavaTypeIconsState {
  /** path → info; `null` means sniffed with no type (avoid re-read). */
  byPath: Map<string, JavaTypeInfo | null>;
}

export const useJavaTypeIcons = create<JavaTypeIconsState>(() => ({ byPath: new Map() }));

export function getJavaTypeIcon(path: string): string | null {
  const info = useJavaTypeIcons.getState().byPath.get(path);
  return info ? javaTypeIconName(info) : null;
}

const SNIFF_EXT = /\.(java|kt)$/i;
const MAX_BYTES = 12_000;
const CONCURRENCY = 4;

let chain: Promise<void> = Promise.resolve();
const queued = new Set<string>();

async function sniffPath(path: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const text = (await call(commands.fsReadText(path))).slice(0, MAX_BYTES);
    const info = sniffJavaTypeKind(text);
    useJavaTypeIcons.setState((s) => {
      const byPath = new Map(s.byPath);
      byPath.set(path, info);
      return { byPath };
    });
  } catch {
    useJavaTypeIcons.setState((s) => {
      const byPath = new Map(s.byPath);
      byPath.set(path, null);
      return { byPath };
    });
  }
}

/** After a directory listing loads, sniff Java/Kotlin files we have not seen yet. */
export function scheduleJavaTypeSniffs(paths: readonly string[]): void {
  const pending = paths.filter(
    (p) => SNIFF_EXT.test(p) && !useJavaTypeIcons.getState().byPath.has(p) && !queued.has(p),
  );
  for (const p of pending) queued.add(p);
  if (!pending.length) return;
  chain = chain.then(async () => {
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((p) => sniffPath(p).finally(() => queued.delete(p))));
    }
  });
}

/** Drop cached sniffs under removed / reloaded paths. */
export function invalidateJavaTypeIcons(prefixes: readonly string[]): void {
  useJavaTypeIcons.setState((s) => {
    const byPath = new Map(s.byPath);
    for (const key of [...byPath.keys()]) {
      if (prefixes.some((p) => key === p || key.startsWith(p.endsWith("/") ? p : `${p}/`))) byPath.delete(key);
    }
    return { byPath };
  });
}
