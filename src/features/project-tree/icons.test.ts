import { describe, expect, it } from "vitest";
import type { RootFolder } from "@/platform/languageSettings";
import {
  applicationClassIcons,
  applicationFileIcon,
  javaTestFileIcon,
  moduleFolderIcon,
  projectNodeIcon,
} from "./icons";

const pom = (path: string, from: string): RootFolder => ({
  path,
  kind: "source",
  detectedFrom: from,
});

describe("moduleFolderIcon", () => {
  const detected = [
    pom("src/main/java", "pom.xml"),
    pom("core/src/main/java", "core/pom.xml"),
    pom("app/src/main/java", "app/pom.xml"),
    pom("web/src", "web/package.json"),
    pom("lib/src/main/java", "lib/build.gradle.kts"),
  ];

  it("uses maven-project for the root Maven module", () => {
    expect(moduleFolderIcon("", detected)).toBe("maven-project");
  });

  it("uses maven-module for nested Maven modules", () => {
    expect(moduleFolderIcon("core", detected)).toBe("maven-module");
    expect(moduleFolderIcon("app", detected)).toBe("maven-module");
  });

  it("uses file-gradle for Gradle modules", () => {
    expect(moduleFolderIcon("lib", detected)).toBe("file-gradle");
  });

  it("ignores non-JVM build files", () => {
    expect(moduleFolderIcon("web", detected)).toBeNull();
  });

  it("returns null when the folder is not a module", () => {
    expect(moduleFolderIcon("src/main/java", detected)).toBeNull();
  });
});

describe("applicationFileIcon", () => {
  const apps = applicationClassIcons([
    { kind: "spring-boot", name: "DemoApplication" },
    { kind: "application", name: "Main" },
    { kind: "maven", name: "mvn package" },
  ]);

  it("maps Spring Boot and Application configs by simple class name", () => {
    expect(applicationFileIcon("DemoApplication.java", apps)).toBe("spring-boot");
    expect(applicationFileIcon("Main.java", apps)).toBe("class");
    expect(applicationFileIcon("Other.java", apps)).toBeNull();
  });

  it("matches Kotlin file facades ending in Kt", () => {
    const kt = applicationClassIcons([{ kind: "spring-boot", name: "AppKt" }]);
    expect(applicationFileIcon("App.kt", kt)).toBe("spring-boot");
  });
});

describe("javaTestFileIcon", () => {
  it("matches JUnit-style suffixes without false positives", () => {
    expect(javaTestFileIcon("OrderTest.java")).toBe("file-java-test");
    expect(javaTestFileIcon("OrderTests.kt")).toBe("file-java-test");
    expect(javaTestFileIcon("FlowIT.java")).toBe("file-java-test");
    expect(javaTestFileIcon("Contest.java")).toBeNull();
    expect(javaTestFileIcon("DemoApplication.java")).toBeNull();
  });
});
describe("projectNodeIcon", () => {
  const detected = [pom("src/main/java", "pom.xml"), pom("core/src/main/java", "core/pom.xml")];
  const apps = applicationClassIcons([{ kind: "spring-boot", name: "DemoApplication" }]);

  it("marks Maven roots and nested modules", () => {
    expect(
      projectNodeIcon({ path: "/p", label: "p", dir: true, root: true, excluded: false }, [], "/p", detected),
    ).toBe("maven-project");
    expect(
      projectNodeIcon({ path: "/p/core", label: "core", dir: true, root: false, excluded: false }, [], "/p", detected),
    ).toBe("maven-module");
  });

  it("uses module-java for JVM projects without a Maven/Gradle module folder icon", () => {
    const roots = [{ path: "src/main/java", kind: "source" as const, detectedFrom: null }];
    expect(projectNodeIcon({ path: "/p", label: "p", dir: true, root: true, excluded: false }, roots, "/p", [])).toBe(
      "module-java",
    );
  });

  it("keeps the plain module icon when no JVM build file is detected", () => {
    expect(projectNodeIcon({ path: "/p", label: "p", dir: true, root: true, excluded: false }, [], "/p", [])).toBe(
      "module",
    );
  });

  it("uses Spring Boot / Application icons for launch classes", () => {
    expect(
      projectNodeIcon(
        {
          path: "/p/src/main/java/DemoApplication.java",
          label: "DemoApplication.java",
          dir: false,
          root: false,
          excluded: false,
        },
        [],
        "/p",
        detected,
        apps,
      ),
    ).toBe("spring-boot");
    expect(
      projectNodeIcon(
        {
          path: "/p/src/main/java/Other.java",
          label: "Other.java",
          dir: false,
          root: false,
          excluded: false,
        },
        [],
        "/p",
        detected,
        apps,
      ),
    ).toBe("file-java");
  });

  it("uses generated / compiled / test / class file glyphs", () => {
    expect(
      projectNodeIcon(
        {
          path: "/p/target/generated-sources/annotations",
          label: "annotations",
          dir: true,
          root: false,
          excluded: true,
        },
        [],
        "/p",
      ),
    ).toBe("folder-generated-source");
    expect(
      projectNodeIcon(
        { path: "/p/target/classes", label: "classes", dir: true, root: false, excluded: true },
        [],
        "/p",
      ),
    ).toBe("folder-compiled");
    expect(
      projectNodeIcon(
        {
          path: "/p/src/test/java/OrderTest.java",
          label: "OrderTest.java",
          dir: false,
          root: false,
          excluded: false,
        },
        [],
        "/p",
      ),
    ).toBe("file-java-test");
    expect(
      projectNodeIcon(
        { path: "/p/out/Foo.class", label: "Foo.class", dir: false, root: false, excluded: false },
        [],
        "/p",
      ),
    ).toBe("file-binary");
    expect(
      projectNodeIcon(
        {
          path: "/p/src/main/java/module-info.java",
          label: "module-info.java",
          dir: false,
          root: false,
          excluded: false,
        },
        [],
        "/p",
      ),
    ).toBe("module");
    expect(
      projectNodeIcon(
        {
          path: "/p/src/main/java/com/example/package-info.java",
          label: "package-info.java",
          dir: false,
          root: false,
          excluded: false,
        },
        [],
        "/p",
      ),
    ).toBe("package");
  });

  it("uses source-root and package glyphs under Maven layouts", () => {
    const roots = [
      { path: "src/main/java", kind: "source" as const, detectedFrom: "pom.xml" },
      { path: "src/main/resources", kind: "resources" as const, detectedFrom: "pom.xml" },
      { path: "src/test/java", kind: "test" as const, detectedFrom: "pom.xml" },
    ];
    expect(
      projectNodeIcon(
        { path: "/p/src/main/java", label: "java", dir: true, root: false, excluded: false },
        roots,
        "/p",
        roots,
      ),
    ).toBe("folder-source");
    expect(
      projectNodeIcon(
        { path: "/p/src/main/resources", label: "resources", dir: true, root: false, excluded: false },
        roots,
        "/p",
        roots,
      ),
    ).toBe("folder-resources");
    expect(
      projectNodeIcon(
        { path: "/p/src/test/java", label: "java", dir: true, root: false, excluded: false },
        roots,
        "/p",
        roots,
      ),
    ).toBe("folder-test");
    expect(
      projectNodeIcon(
        { path: "/p/src/main/java/com/example", label: "com.example", dir: true, root: false, excluded: false },
        roots,
        "/p",
        roots,
      ),
    ).toBe("package");
    expect(
      projectNodeIcon({ path: "/p/src", label: "src", dir: true, root: false, excluded: false }, roots, "/p", roots),
    ).toBe("folder");
  });

  it("keeps yaml file-type icons (and Spring Boot for application*.yml)", () => {
    expect(
      projectNodeIcon(
        {
          path: "/p/src/main/resources/application.yml",
          label: "application.yml",
          dir: false,
          root: false,
          excluded: false,
        },
        [],
        "/p",
      ),
    ).toBe("spring-boot");
    expect(
      projectNodeIcon(
        {
          path: "/p/config.yml",
          label: "config.yml",
          dir: false,
          root: false,
          excluded: false,
        },
        [],
        "/p",
      ),
    ).toBe("file-yaml");
  });
});
