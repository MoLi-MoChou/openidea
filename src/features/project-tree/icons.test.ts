import { describe, expect, it } from "vitest";
import type { RootFolder } from "@/platform/languageSettings";
import { applicationClassIcons, applicationFileIcon, moduleFolderIcon, projectNodeIcon } from "./icons";

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
