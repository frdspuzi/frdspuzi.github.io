import { describe, expect, it } from "vitest";
import { getLegacyDomainRedirectTarget } from "./legacyDomainRedirect";

describe("getLegacyDomainRedirectTarget", () => {
  it("redirects a bare visit to the old GitHub Pages host to the canonical domain", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "frdspuzi.github.io",
        pathname: "/",
        search: "",
        hash: "",
      }),
    ).toBe("https://firdauspuzi.com/");
  });

  it("preserves the path on the old host", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "frdspuzi.github.io",
        pathname: "/2019/01/29/hello-world/",
        search: "",
        hash: "",
      }),
    ).toBe("https://firdauspuzi.com/2019/01/29/hello-world/");
  });

  it("preserves a query string alone on the old host", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "frdspuzi.github.io",
        pathname: "/",
        search: "?ref=resume",
        hash: "",
      }),
    ).toBe("https://firdauspuzi.com/?ref=resume");
  });

  it("preserves a hash alone on the old host", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "frdspuzi.github.io",
        pathname: "/",
        search: "",
        hash: "#photography",
      }),
    ).toBe("https://firdauspuzi.com/#photography");
  });

  it("preserves query string and hash together on the old host", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "frdspuzi.github.io",
        pathname: "/",
        search: "?ref=resume",
        hash: "#photography",
      }),
    ).toBe("https://firdauspuzi.com/?ref=resume#photography");
  });

  it("does not redirect on the canonical domain", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "firdauspuzi.com",
        pathname: "/",
        search: "",
        hash: "",
      }),
    ).toBeNull();
  });

  it("does not redirect on www of the canonical domain", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "www.firdauspuzi.com",
        pathname: "/",
        search: "",
        hash: "",
      }),
    ).toBeNull();
  });

  it("does not redirect on an unrelated host, e.g. local dev", () => {
    expect(
      getLegacyDomainRedirectTarget({
        hostname: "localhost",
        pathname: "/",
        search: "",
        hash: "",
      }),
    ).toBeNull();
  });
});
