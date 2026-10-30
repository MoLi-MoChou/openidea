import { describe, expect, it } from "vitest";
import { javaTypeIconName, sniffJavaTypeKind } from "./javaTypeIcons";

describe("sniffJavaTypeKind", () => {
  it("detects class, abstract class, interface, enum, record, annotation", () => {
    expect(sniffJavaTypeKind("package p;\npublic class Foo {}\n")?.kind).toBe("class");
    expect(sniffJavaTypeKind("public abstract class Foo {}\n")?.kind).toBe("class-abstract");
    expect(sniffJavaTypeKind("public interface Foo {}\n")?.kind).toBe("interface");
    expect(sniffJavaTypeKind("public enum Foo { A }\n")?.kind).toBe("enum");
    expect(sniffJavaTypeKind("public record Foo(int x) {}\n")?.kind).toBe("record");
    expect(sniffJavaTypeKind("public @interface Foo {}\n")?.kind).toBe("annotation");
  });

  it("detects Kotlin forms", () => {
    expect(sniffJavaTypeKind("interface Foo\n")?.kind).toBe("interface");
    expect(sniffJavaTypeKind("enum class Foo { A }\n")?.kind).toBe("enum");
    expect(sniffJavaTypeKind("data class Foo(val x: Int)\n")?.kind).toBe("class");
    expect(sniffJavaTypeKind("abstract class Foo\n")?.kind).toBe("class-abstract");
    expect(sniffJavaTypeKind("annotation class Foo\n")?.kind).toBe("annotation");
  });

  it("ignores noise in comments and strings", () => {
    expect(sniffJavaTypeKind('/** interface Fake */\npublic class Real {\n  String s = "enum X";\n}\n')?.kind).toBe(
      "class",
    );
  });

  it("marks Spring stereotypes with the Spring Boot glyph", () => {
    const info = sniffJavaTypeKind(
      "package p;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\npublic class Api {}\n",
    );
    expect(info).toEqual({ kind: "class", spring: true });
    expect(javaTypeIconName(info!)).toBe("spring-boot");
    expect(javaTypeIconName(sniffJavaTypeKind("@Service\npublic class Orders {}\n")!)).toBe("spring-boot");
    expect(javaTypeIconName(sniffJavaTypeKind("public interface Port {}\n")!)).toBe("interface");
  });
});
