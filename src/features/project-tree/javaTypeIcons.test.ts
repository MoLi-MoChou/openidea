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

  it("uses the Boot glyph only for @SpringBootApplication, not other stereotypes", () => {
    const boot = sniffJavaTypeKind(
      "package p;\n@SpringBootApplication\npublic class App {\n  public static void main(String[] a) {}\n}\n",
    );
    expect(boot).toEqual({ kind: "class", spring: true });
    expect(javaTypeIconName(boot!)).toBe("spring-boot");
    // No Ultimate stereotype assets: @RestController stays a class icon.
    expect(javaTypeIconName(sniffJavaTypeKind("@RestController\npublic class Api {}\n")!)).toBe("class");
    expect(javaTypeIconName(sniffJavaTypeKind("@Service\npublic class Orders {}\n")!)).toBe("class");
    expect(javaTypeIconName(sniffJavaTypeKind("public interface Port {}\n")!)).toBe("interface");
  });
});
