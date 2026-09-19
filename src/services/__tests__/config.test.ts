// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearTurnstileCredentials,
  getStaticSiteTitle,
  getTurnstileVerified,
  setTurnstileToken,
  setTurnstileVerified,
  subscribeTurnstileVerified,
} from "@/services/cfsm/config";

afterEach(() => {
  document.head.innerHTML = "";
  window.localStorage.clear();
});

describe("getStaticSiteTitle", () => {
  it("reads the TITLE that build-static.mjs writes into <meta name=\"siteTitle\">", () => {
    // 脚本和这里靠这个 meta 名对上：改一边忘了另一边，静态部署设的 TITLE 挂载后又会被后台标题盖掉。
    const meta = document.createElement("meta");
    meta.name = "siteTitle";
    meta.content = "  我的监控  ";
    document.head.append(meta);

    expect(getStaticSiteTitle()).toBe("我的监控");
  });

  it("is empty for Worker-hosted pages, so the backend site title applies", () => {
    expect(getStaticSiteTitle()).toBe("");
  });
});

describe("subscribeTurnstileVerified（验证一通过数据页就挂上来）", () => {
  it("notifies when verification yields a credential, and again when it gets rejected", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTurnstileVerified(listener);

    setTurnstileToken("one-time-token");
    expect(listener).not.toHaveBeenCalled();

    setTurnstileVerified("credential");
    expect(getTurnstileVerified()).toBe("credential");
    expect(listener).toHaveBeenCalledTimes(1);

    clearTurnstileCredentials();
    expect(getTurnstileVerified()).toBe("");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("stays quiet when a response merely echoes the same credential, or there was nothing to clear", () => {
    setTurnstileVerified("credential");
    const listener = vi.fn();
    const unsubscribe = subscribeTurnstileVerified(listener);

    // 每个带凭证的响应都会回写一遍。
    setTurnstileVerified("credential");
    clearTurnstileCredentials();
    clearTurnstileCredentials();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
