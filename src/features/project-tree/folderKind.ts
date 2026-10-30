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
 * Project Structure marks and roots detected from build files. Like IDEA:
 * - source / test / resources roots get their root glyphs
 * - packages under JVM (or Python) source/test roots get the package glyph
 * - only excluded folders get the excluded icon; git-ignored ones keep the plain one
 */
export function folderKind(
  node: Pick<ProjectNode, "path" | "excluded">,
  roots: readonly RootFolder[],
  root: string | null,
  detected: readonly RootFolder[] = [],
): FolderKind {
  if (node.excluded) return "excluded";
  if (!root) return basename(node.path) === ".github" ? "github" : "plain";
  const rel = node.path === root ? "" : relativePath(root, node.path);
  const role = rootRole(roots, rel);
  if (role) return ROLE_KIND[role];
  // IDEA `PackageElementNode` → PlatformIcons.Package under source/test roots.
  if (packageKindAt(rel, roots, detected)) return "package";
  return basename(node.path) === ".github" ? "github" : "plain";
}
