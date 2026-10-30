import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RootFolder } from "@/platform/languageSettings";
import { useProject } from "@/platform/project";
import { useProjectRoots } from "@/platform/projectRoots";
import type { MenuItem } from "@/ui";
import { newMenuItems } from "./contextMenu";
import { folderKind } from "./folderKind";
import { MemoryFs, setProjectFsForTests } from "./fs";
import { beginNewPackage, checkEditingName, commitEditing } from "./operations";
import { packageKindAt } from "./packages";
import { packageSegments } from "./paths";
import { initProjectTree, loadDir } from "./store";

const root = (path: string, kind: RootFolder["kind"], detectedFrom: string | null): RootFolder => ({
  path,
  kind,
  detectedFrom,
});

const MAVEN: RootFolder[] = [
  root("src/main/java", "source", "pom.xml"),
  root("src/main/resources", "resources", "pom.xml"),
  root("src/test/java", "test", "pom.xml"),
  root("src/test/resources", "testResources", "pom.xml"),
  root("target", "excluded", "pom.xml"),
];

describe("folder icons", () => {
  it("follow detected and marked roots", () => {
    const kind = (rel: string, excluded = false) => folderKind({ path: `/p/${rel}`, excluded }, MAVEN, "/p");
    expect(kind("src/main/java")).toBe("source");
    expect(kind("src/main/resources")).toBe("resources");
    expect(kind("src/test/java")).toBe("test");
    expect(kind("src/test/resources")).toBe("testResources");
    expect(kind("target")).toBe("excluded");
    expect(kind("src")).toBe("plain");
    expect(kind("src/main")).toBe("plain");
    expect(kind("docs", true)).toBe("excluded");
    expect(kind(".github")).toBe("github");
  });

  it("marks packages under JVM source and test roots (IDEA PackageElementNode)", () => {
    const kind = (rel: string) => folderKind({ path: `/p/${rel}`, excluded: false }, MAVEN, "/p");
    expect(kind("src/main/java/com")).toBe("package");
    expect(kind("src/main/java/com/example")).toBe("package");
    expect(kind("src/test/java/com/example")).toBe("package");
    // Resource folders stay plain folders, not packages.
    expect(kind("src/test/resources/db")).toBe("plain");
  });

  it("marks generated / compiled / javadoc output folders (IDEA Modules.*)", () => {
    const kind = (rel: string, excluded = true) => folderKind({ path: `/p/${rel}`, excluded }, MAVEN, "/p");
    expect(kind("target/generated-sources")).toBe("generatedSource");
    expect(kind("target/generated-sources/annotations")).toBe("generatedSource");
    expect(kind("target/generated-test-sources/test-annotations")).toBe("generatedTest");
    expect(kind("build/generated/sources/annotationProcessor/java/main")).toBe("generatedSource");
    expect(kind("build/generated/sources/annotationProcessor/java/test")).toBe("generatedTest");
    expect(kind("target/classes")).toBe("compiled");
    expect(kind("build/classes")).toBe("compiled");
    expect(kind("target/javadoc")).toBe("javadoc");
    // Do not treat a source package named "classes" as compiled output.
    expect(kind("src/main/java/com/example/classes", false)).toBe("package");
  });
});

describe("New › Package", () => {
  it("is offered inside JVM source roots and Python modules", () => {
    const py = [root("py/src", "source", "py/pyproject.toml")];
    expect(packageKindAt("src/main/java/com", MAVEN)).toBe("jvm");
    expect(packageKindAt("src/test/java", MAVEN)).toBe("jvm");
    expect(packageKindAt("src/test/resources", MAVEN)).toBeNull();
    expect(packageKindAt("target", MAVEN)).toBeNull();
    expect(packageKindAt("gen/kotlin/x", [root("gen/kotlin", "source", null)])).toBe("jvm");
    expect(packageKindAt("py/src/app", py)).toBe("python");
    expect(packageKindAt("py", py)).toBe("python");
    expect(packageKindAt("web", py)).toBeNull();
    // An unmarked Python root still leaves the module a Python module.
    expect(packageKindAt("py/src", [], py)).toBe("python");
  });

  it("validates dotted package names", () => {
    expect(packageSegments("com.acme.util", "jvm")).toEqual({ segments: ["com", "acme", "util"], error: null });
    expect(packageSegments("com..x", "jvm").error).toMatch(/Not a valid package name/);
    expect(packageSegments("com.class", "jvm").error).toMatch(/Not a valid package name/);
    expect(packageSegments("my-app", "python").error).toMatch(/Not a valid package name/);
    expect(packageSegments("lambda", "python").error).toMatch(/Not a valid package name/);
    expect(packageSegments(" ", "python").error).toBe("Name cannot be empty");
  });
});

describe("creating packages", () => {
  let fs: MemoryFs;
  beforeEach(() => {
    fs = new MemoryFs({ "/p/src/main/java/App.java": "x", "/p/pkg/__init__.py": "" }, "/p");
    setProjectFsForTests(fs, "/p");
    initProjectTree("/p", "p");
    useProject.setState({
      project: { name: "p", root: "/p", isGit: false, settings: {} } as never,
      settings: {} as never,
    });
    useProjectRoots.setState({ root: "/p", detected: MAVEN });
  });
  afterEach(() => {
    setProjectFsForTests(null);
    initProjectTree(null);
    useProject.setState({ project: null, settings: null });
    useProjectRoots.setState({ root: null, detected: [] });
  });

  it("New menu shows Package instead of Directory in a Java source root", () => {
    const labels = (items: MenuItem[]) => items.map((i) => ("label" in i ? i.label : "-"));
    expect(labels(newMenuItems("/p/src/main/java")).slice(0, 2)).toEqual(["File", "Package"]);
    expect(labels(newMenuItems("/p")).slice(0, 2)).toEqual(["File", "Directory"]);
  });

  it("a dotted JVM package creates nested folders", async () => {
    await loadDir("/p/src/main/java");
    await beginNewPackage("jvm", "/p/src/main/java");
    expect(checkEditingName("com.class").error).toMatch(/Not a valid package name/);
    expect(await commitEditing("com.acme")).toBe(true);
    expect(fs.nodes.get("/p/src/main/java/com/acme")?.kind).toBe("dir");
  });

  it("a Python package gets an __init__.py in every new folder", async () => {
    await loadDir("/p/pkg");
    await beginNewPackage("python", "/p/pkg");
    expect(await commitEditing("api.v1")).toBe(true);
    expect(fs.nodes.has("/p/pkg/api/__init__.py")).toBe(true);
    expect(fs.nodes.has("/p/pkg/api/v1/__init__.py")).toBe(true);
  });
});
