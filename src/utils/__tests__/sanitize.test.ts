import { stripHtml, escapeLikePattern } from "@/utils/sanitize";

describe("stripHtml", () => {
  it("should remove simple HTML tags", () => {
    expect(stripHtml("<b>bold</b>")).toBe("bold");
  });

  it("should remove script tags", () => {
    expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it("should remove nested tags", () => {
    expect(stripHtml("<div><p>Hello</p></div>")).toBe("Hello");
  });

  it("should trim whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  it("should return empty string for tag-only input", () => {
    expect(stripHtml("<br/>")).toBe("");
  });

  it("should leave plain text unchanged", () => {
    expect(stripHtml("Hello World")).toBe("Hello World");
  });

  it("should handle empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("should handle self-closing tags", () => {
    expect(stripHtml("before<img src='x' />after")).toBe("beforeafter");
  });

  it("should handle tags with attributes", () => {
    expect(stripHtml('<a href="http://evil.com">click me</a>')).toBe("click me");
  });
});

describe("escapeLikePattern", () => {
  it("should escape percent signs", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("should escape underscores", () => {
    expect(escapeLikePattern("user_name")).toBe("user\\_name");
  });

  it("should escape backslashes", () => {
    expect(escapeLikePattern("path\\to")).toBe("path\\\\to");
  });

  it("should escape all special characters together", () => {
    expect(escapeLikePattern("%_\\")).toBe("\\%\\_\\\\");
  });

  it("should leave normal text unchanged", () => {
    expect(escapeLikePattern("hello world")).toBe("hello world");
  });

  it("should handle empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});
