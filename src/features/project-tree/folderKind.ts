/** Folder icon kind in the project view, from the effective roots. */
import { rootRole, type FolderRole, type RootFolder } from "@/platform/languageSettings";
import { basename, relativePath } from "@/platform/project";
import type { FolderKind } from "@/ui";
import type { ProjectNode } from "./model";
import { packageKindAt } from "./packages";

const ROLE_KIND: Record<FolderRole, FolderKind> = {
  source: "source",
  test: "test",
  resources: "resources",
  testResources: "testResources",
  excluded: "excluded",
};

/**
 * Maven / Gradle generated and output folders (IDEA Modules.*Generated* /
 * CompiledClassesFolder). Checked before the excluded glyph so Show Excluded
 * still shows the more specific icon on `target/generated-sources`, etc.
 */
export function specialFolderKind(rel: string): FolderKind | null {
  // Build-output folders (avoid bare "classes" / "javadoc" package names).
  if (/(^|\/)(target|build|out|bin)\/(test-)?classes$/i.test(rel)) return "compiled";
  if (/(^|\/)(target|build)\/(apidocs|javadoc)$/i.test(rel)) return "javadoc";
  // Maven: target/generated-sources[/annotations], generated-test-sources[/…]
  if (/(^|\/)generated-test-sources(\/|$)/i.test(rel)) return "generatedTest";
  if (/(^|\/)generated-sources(\/|$)/i.test(rel)) return "generatedSource";
  // Gradle / KAPT: build/generated/sources?/… or …/kapt/…
  if (/(^|\/)generated\/sources?\/.+/i.test(rel) || /(^|\/)generated\/(kapt|source)\//i.test(rel)) {
    return /\/(test|testFixtures)(\/|$)/i.test(rel) ? "generatedTest" : "generatedSource";
  }
  // Bare `generated` only under a build output tree.
  if (/(^|\/)(target|build)\/generated$/i.test(rel)) return "generatedSource";
  return null;
}

/**
 * Project Structure marks and roots detected from build files. Like IDEA:
 * - source / test / resources roots get their root glyphs
 * - generated / compiled / javadoc folders get Modules.* glyphs
 * - packages under JVM (or Python) source/test roots get the package glyph
 * - only plain excluded folders get the excluded icon; git-ignored ones keep the plain one
 */
export function folderKind(
  node: Pick<ProjectNode, "path" | "excluded">,
  roots: readonly RootFolder[],
  root: string | null,
  detected: readonly RootFolder[] = [],
): FolderKind {
  if (!root) {
    if (node.excluded) return "excluded";
    return basename(node.path) === ".github" ? "github" : "plain";
  }
  const rel = node.path === root ? "" : relativePath(root, node.path);
  const special = specialFolderKind(rel);
  if (special) return special;
  if (node.excluded) return "excluded";
  const role = rootRole(roots, rel);
  if (role) return ROLE_KIND[role];
  // IDEA `PackageElementNode` → PlatformIcons.Package under source/test roots.
  if (packageKindAt(rel, roots, detected)) return "package";
  return basename(node.path) === ".github" ? "github" : "plain";
}
