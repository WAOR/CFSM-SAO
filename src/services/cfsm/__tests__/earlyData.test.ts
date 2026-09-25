// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { cfsmGet, cfsmGetAll, discardEarlyConfig, discardEarlyData } from "@/services/cfsm/http";
import { resetApiBaseCache } from "@/services/cfsm/config";

const DummyConfigSchema = z.object({
  sitename: z.string(),
});

const DummyServersSchema = z.object({
  servers: z.array(z.object({ id: z.string() })),
});

describe("Early Data Prefetching consumption", () => {
  const originalEarlyData = (window as unknown as { __EARLY_DATA__?: unknown }).__EARLY_DATA__;

  beforeEach(() => {
    resetApiBaseCache();
    (window as unknown as { __EARLY_DATA__?: unknown }).__EARLY_DATA__ = undefined;
  });

  afterEach(() => {
    (window as unknown as { __EARLY_DATA__?: unknown }).__EARLY_DATA__ = originalEarlyData;
    vi.restoreAllMocks();
  });

  it("consumes early config data when available and clears the reference", async () => {
    const earlyPromise = Promise.resolve({ sitename: "Prefetched SAO" });
    (window as unknown as { __EARLY_DATA__?: unknown }).__EARLY_DATA__ = {
      config: earlyPromise,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await cfsmGet("/api/config", DummyConfigSchema);
    expect(result.sitename).toBe("Prefetched SAO");
    // 不应触发额外的 fetch 请求
    expect(fetchSpy).not.toHaveBeenCalled();

    // 消费后应被置空，防止二次重复消费旧值
    const win = window as unknown as { __EARLY_DATA__?: { config?: unknown } };
    expect(win.__EARLY_DATA__?.config).toBeNull();
  });

  it("drops the prefetched config so the post-verification read hits the network", async () => {
    // 预取的 config 是验证前拉的（bypass、无凭证）。TurnstileGate 提交验证前必须
    // discardEarlyConfig() —— 否则带一次性 token 的这次 getSiteConfig 会直接吃到过期缓存，
    // token 根本没发出去、凭证永远存不上，首次验证通过也报「验证未通过，请重试」。
    (window as unknown as { __EARLY_DATA__?: unknown }).__EARLY_DATA__ = {
      config: Promise.resolve({ sitename: "Stale pre-verification" }),
    };
    discardEarlyConfig();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sitename: "Fresh verified" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await cfsmGet("/api/config", DummyConfigSchema);
    expect(result.sitename).toBe("Fresh verified");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("consumes early servers data when available and clears the reference", async () => {
    const earlyServerData = { servers: [{ id: "srv-1" }] };
    const earlyServersPromise = Promise.resolve({
      base: window.location.origin,
      data: earlyServerData,
    });

    (window as unknown as { __EARLY_DATA__?: unknown }).__EARLY_DATA__ = {
      servers: [{ base: window.location.origin, promise: earlyServersPromise }],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const results = await cfsmGetAll("/api/servers", DummyServersSchema);
    expect(results).toHaveLength(1);
    expect(results[0]?.data?.servers[0]?.id).toBe("srv-1");
    // 不应触发额外的 fetch 请求
    expect(fetchSpy).not.toHaveBeenCalled();

    // 消费后应被置空
    const win = window as unknown as { __EARLY_DATA__?: { servers?: unknown } };
    expect(win.__EARLY_DATA__?.servers).toBeNull();
  });

  it("discardEarlyData drops both prefetched config and servers so post-verification fetch hits the network", async () => {
    (window as unknown as { __EARLY_DATA__?: unknown }).__EARLY_DATA__ = {
      config: Promise.resolve({ sitename: "Stale" }),
      servers: [
        {
          base: window.location.origin,
          promise: Promise.resolve({ base: window.location.origin, error: new Error("403") }),
        },
      ],
    };

    discardEarlyData();

    const win = window as unknown as {
      __EARLY_DATA__?: { config?: unknown; servers?: unknown };
    };
    expect(win.__EARLY_DATA__?.config).toBeNull();
    expect(win.__EARLY_DATA__?.servers).toBeNull();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ servers: [{ id: "srv-fresh" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const results = await cfsmGetAll("/api/servers", DummyServersSchema);
    expect(results).toHaveLength(1);
    expect(results[0]?.data?.servers[0]?.id).toBe("srv-fresh");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
