/**
 * Project-view icons that need more than a file name: Maven / Gradle module
 * folders (IDEA's MavenIconProvider), source/test/resource/package folders
 * (IDEA content roots + PackageElementNode), and Application / Spring Boot
 * launch classes (detected run configurations).
 */
import type { RootFolder } from "@/platform/languageSettings";
import { relativePath } from "@/platform/project";
import { fileIconName, folderIconName } from "@/ui";
import { folderKind } from "./folderKind";
import type { ProjectNode } from "./model";

/** Build-file basename → Project-view icon for that module directory. */
function iconForBuildFile(base: string, nested: boolean): string | null {
  if (base === "pom.xml") return nested ? "maven-module" : "maven-project";
  if (/^build\.gradle(\.kts)?$/.test(base) || /^settings\.gradle(\.kts)?$/.test(base)) return "file-gradle";
  return null;
}

/**
 * Icon for a module directory (project-relative `""` for the root), from the
 * build files that produced its detected roots. Like IDEA's MavenIconProvider:
 * Mavenized folders show the Maven glyph instead of a plain module / folder.
 */
export function moduleFolderIcon(moduleRel: string, detected: readonly RootFolder[]): string | null {
  for (const r of detected) {
    if (!r.detectedFrom) continue;
    const slash = r.detectedFrom.lastIndexOf("/");
    const dir = slash < 0 ? "" : r.detectedFrom.slice(0, slash);
    if (dir !== moduleRel) continue;
    const base = slash < 0 ? r.detectedFrom : r.detectedFrom.slice(slash + 1);
    const icon = iconForBuildFile(base, moduleRel !== "");
    if (icon) return icon;
  }
  return null;
}

/** Simple class name → Project-view icon for Application / Spring Boot configs. */
export function applicationClassIcons(configs: readonly { kind: string; name: string }[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const c of configs) {
    if (c.kind === "spring-boot") out.set(c.name, "spring-boot");
    else if (c.kind === "application") out.set(c.name, "class");
  }
  return out;
}

/** JUnit-style type names (IDEA marks test PsiClasses with the test glyph). */
export function isJavaTestTypeName(stem: string): boolean {
  return /(?:Test|Tests|TestCase|IT|ITCase)$/.test(stem);
}

/** Icon for a Java / Kotlin test source by type name (case-sensitive suffix). */
export function javaTestFileIcon(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  if (ext !== "java" && ext !== "kt") return null;
  return isJavaTestTypeName(fileName.slice(0, dot)) ? "file-java-test" : null;
}

/**
 * Icon for a Java / Kotlin source whose simple class name matches a detected
 * Application or Spring Boot run configuration (IDEA marks those files specially).
 */
export function applicationFileIcon(fileName: string, apps: ReadonlyMap<string, string>): string | null {
  if (!apps.size) return null;
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  if (ext !== "java" && ext !== "kt") return null;
  const stem = fileName.slice(0, dot);
  return apps.get(stem) ?? (ext === "kt" ? (apps.get(`${stem}Kt`) ?? null) : null);
}

/** True when the project has JVM source/test roots (IDEA Java module glyph). */
export function isJvmModuleProject(roots: readonly RootFolder[], detected: readonly RootFolder[] = []): boolean {
  return [...roots, ...detected].some(
    (r) =>
      (r.kind === "source" || r.kind === "test") &&
      (/(^|\/)(java|kotlin|scala|groovy)$/.test(r.path) ||
        /(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/.test(r.detectedFrom ?? "")),
  );
}

/** Project-tree row icon (folders, modules, files). */
export function projectNodeIcon(
  node: Pick<ProjectNode, "placeholder" | "icon" | "root" | "dir" | "path" | "label" | "excluded">,
  roots: readonly RootFolder[],
  root: string | null,
  detected: readonly RootFolder[] = [],
  apps: ReadonlyMap<string, string> = new Map(),
): string {
  if (node.placeholder) return node.placeholder === "dir" ? "folder" : "file";
  if (node.icon) return node.icon;
  if (node.dir) {
    if (root) {
      const rel = node.path === root ? "" : relativePath(root, node.path);
      const build = moduleFolderIcon(rel, detected);
      if (build) return build;
    }
    if (node.root) return isJvmModuleProject(roots, detected) ? "module-java" : "module";
    return folderIconName(folderKind(node, roots, root, detected));
  }
  return applicationFileIcon(node.label, apps) ?? javaTestFileIcon(node.label) ?? fileIconName(node.label);
}
