import { describe, expect, it } from "vitest";
import { needsTurnstileVerification } from "@/hooks/useTurnstileVerification";

const site = { turnstile_enabled: true, verified: false, turnstile_site_key: "0x4AAAA" };

describe("needsTurnstileVerification（验证弹窗与数据页挂不挂的同一个口径）", () => {
  it("is required when the site turns it on and this visitor has neither passed nor cached a credential", () => {
    // 2026-09-17 线上站点就是这份 config：主题没等验证就请求 /api/servers，被 403。
    expect(needsTurnstileVerification(site, "")).toBe(true);
  });

  it("is not required once a credential is cached, even before /api/config comes back verified", () => {
    expect(needsTurnstileVerification(site, "credential")).toBe(false);
  });

  it("is not required when the backend already counts this request as verified", () => {
    expect(needsTurnstileVerification({ ...site, verified: true }, "")).toBe(false);
  });

  it("is not required when the site has it off, has no site key, or config has not loaded", () => {
    expect(needsTurnstileVerification({ ...site, turnstile_enabled: false }, "")).toBe(false);
    // 没有公钥渲染不出验证组件，弹了也过不去。
    expect(needsTurnstileVerification({ ...site, turnstile_site_key: "" }, "")).toBe(false);
    expect(needsTurnstileVerification(undefined, "")).toBe(false);
  });
});
