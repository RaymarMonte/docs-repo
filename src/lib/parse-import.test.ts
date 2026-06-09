import { describe, expect, it } from "vitest";
import { parseImportedFile } from "@/lib/parse-import";

describe("parseImportedFile", () => {
  it("renders a markdown heading as an <h1>", () => {
    const { html } = parseImportedFile("notes.md", "# Hello");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
  });

  it("neutralizes a <script> tag in a .txt file", () => {
    const { html } = parseImportedFile(
      "evil.txt",
      "<script>alert('xss')</script>",
    );
    expect(html).not.toContain("<script>");
  });

  it("derives the title from the filename without its extension", () => {
    const { title } = parseImportedFile("My Doc.md", "x");
    expect(title).toBe("My Doc");
  });

  it("throws for an unsupported file extension", () => {
    expect(() => parseImportedFile("photo.png", "x")).toThrow();
  });
});
