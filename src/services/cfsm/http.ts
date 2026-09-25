import { z } from "zod";
import { fetchWithTimeout } from "@/utils/abort";
import {
  clearJwtToken,
  clearTurnstileCredentials,
  getApiBases,
  getJwtToken,
  getPrimaryApiBase,
  getTurnstileToken,
  getTurnstileVerified,
  setTurnstileVerified,
} from "@/services/cfsm/config";

// 普通 GET 没有传输超时，half-open socket 会无限挂住调用方，这里统一兜底。
export const DEFAULT_API_TIMEOUT_MS = 12_000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
    /** 后端错误体里的业务 code，通常与 status 一致。 */
    public readonly code: number = status,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** 数据库需要升级（409）时后端返回 `{ message: "databaseUpgradeRequired" }`。 */
export class DatabaseUpgradeRequiredError extends ApiRequestError {
  constructor(path: string) {
    super("databaseUpgradeRequired", 409, path, 409);
    this.name = "DatabaseUpgradeRequiredError";
  }
}

const ErrorBodySchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
    code: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  /** 指定后端；多站部署时用于把详情/历史请求打到拥有该服务器的站点。 */
  base?: string;
  /** 内部用：真正发请求时不带任何 Turnstile 头。凭证过期后 /api/config 走后端 bypass 重试（见 cfsmGet）。 */
  skipTurnstileHeaders?: boolean;
}

function buildHeaders(skipTurnstile = false): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };

  const token = getJwtToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // 已验证凭证优先；只有还没拿到凭证时才带一次性 token。
  // skipTurnstile：一个 Turnstile 头都不带，好让后端把 /api/config 当未验证请求走 bypass 路径
  // 返回 `verified:false`（后端 index.js：带任一 Turnstile 头就不 bypass、过期凭证会 403）。
  if (!skipTurnstile) {
    const verified = getTurnstileVerified();
    if (verified) {
      headers["X-Turnstile-Verified"] = verified;
    } else {
      const turnstileToken = getTurnstileToken();
      if (turnstileToken) headers["X-Turnstile-Token"] = turnstileToken;
    }
  }

  return headers;
}

async function readErrorBody(resp: Response) {
  try {
    const parsed = ErrorBodySchema.safeParse(await resp.json());
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function captureTurnstileVerified(payload: unknown): void {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  const value = (payload as Record<string, unknown>).turnstile_verified;
  if (typeof value === "string" && value) setTurnstileVerified(value);
}

interface EarlyServersItem {
  base: string;
  promise: Promise<{ base: string; data?: unknown; error?: unknown }>;
}

interface EarlyDataWindow {
  __EARLY_DATA__?: {
    config?: Promise<unknown> | null;
    servers?: EarlyServersItem[] | null;
  };
}

/**
 * 丢弃超前预取的所有数据（主站 /api/config 与各站 /api/servers）。
 *
 * 预取发生在新访客还没通过人机验证时（未带凭证）：
 * - /api/config 响应是 verified:false、没有凭证；
 * - /api/servers 则会被后端直接 403 拒绝。
 * 用户在弹窗完成 Turnstile 验证后，这两份缓存均已失效。如果不丢弃：
 * - config 会导致一次性 token 无法发出、凭证存不上；
 * - servers 会导致首页直接消费验证前 403 失败的 Promise，出现数据同步报错。
 */
export function discardEarlyData(): void {
  if (typeof window === "undefined") return;
  const earlyWin = window as unknown as EarlyDataWindow;
  if (earlyWin.__EARLY_DATA__) {
    earlyWin.__EARLY_DATA__.config = null;
    earlyWin.__EARLY_DATA__.servers = null;
  }
}

/** 兼容旧命名，见 {@link discardEarlyData}。 */
export function discardEarlyConfig(): void {
  discardEarlyData();
}

/**
 * 单个后端的 GET 的实际收发：拼地址、发请求、处理非 2xx、校验 schema。
 * `options.skipTurnstileHeaders` 为真时不带任何 Turnstile 头（凭证过期后 /api/config 走 bypass 重试）。
 */
async function fetchAndParse<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options?: RequestOptions,
): Promise<z.output<S>> {
  const base = options?.base ?? getPrimaryApiBase();
  const url = `${base}${path}`;
  const resp = await fetchWithTimeout(
    url,
    { credentials: "include", headers: buildHeaders(options?.skipTurnstileHeaders) },
    options?.timeout ?? DEFAULT_API_TIMEOUT_MS,
    options?.signal,
  );

  if (!resp.ok) {
    const body = await readErrorBody(resp);
    if (resp.status === 401) {
      // 令牌过期后清掉，让后续请求以访客身份继续；不做跳转 —— 主题不接管登录。
      clearJwtToken();
    }
    if (resp.status === 403) {
      clearTurnstileCredentials();
    }
    if (resp.status === 409 || body?.message === "databaseUpgradeRequired") {
      throw new DatabaseUpgradeRequiredError(path);
    }
    const code = Number(body?.code);
    throw new ApiRequestError(
      body?.error || body?.message || `Request ${path} failed: ${resp.status}`,
      resp.status,
      path,
      Number.isFinite(code) && code > 0 ? code : resp.status,
    );
  }

  const json = (await resp.json()) as unknown;
  captureTurnstileVerified(json);

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Schema mismatch on ${path}: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

/**
 * 单个后端的 GET。成功响应直接是业务对象（没有 `{status,data}` 包装），
 * 失败响应是 `{ error, code }`。
 */
export async function cfsmGet<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options?: RequestOptions,
): Promise<z.output<S>> {
  // 消费超前预取的主站 /api/config
  if (
    path === "/api/config" &&
    (!options?.base || options.base === getPrimaryApiBase()) &&
    !options?.signal &&
    typeof window !== "undefined"
  ) {
    const earlyWin = window as unknown as EarlyDataWindow;
    const earlyConfig = earlyWin.__EARLY_DATA__?.config;
    if (earlyConfig) {
      earlyWin.__EARLY_DATA__!.config = null;
      try {
        const raw = await earlyConfig;
        if (raw) {
          captureTurnstileVerified(raw);
          const parsed = schema.safeParse(raw);
          if (parsed.success) {
            return parsed.data;
          }
        }
      } catch {
        // 异常降级至标准请求
      }
    }
  }

  try {
    return await fetchAndParse(path, schema, options);
  } catch (error) {
    // 凭证过期时带着旧的 X-Turnstile-Verified 请求 /api/config 会被后端 403（带了头就不走 bypass）。
    // fetchAndParse 已把凭证清掉，这里不带任何 Turnstile 头重试一次走 bypass，稳定拿回
    // `verified:false` + site_key —— 否则 /api/config 这次查询停在 error 态、缓存里那份还写着
    // verified:true，TurnstileGate 就不会重新弹人机验证（对齐内置主题 fetchConfig 的 403 重试）。
    if (
      error instanceof ApiRequestError &&
      error.status === 403 &&
      path.startsWith("/api/config") &&
      !options?.skipTurnstileHeaders
    ) {
      return fetchAndParse(path, schema, { ...options, skipTurnstileHeaders: true });
    }
    throw error;
  }
}

/**
 * 单个后端的 POST。目前唯一的写入口是第三方主题保存自身配置（`POST /api/theme_options`，
 * 仅登录站长可用）—— 与 GET 共用鉴权头（Bearer JWT + Turnstile），额外带 JSON body。
 * 401 清 JWT、403 清 Turnstile 凭证的处理与 cfsmGet 一致，调用方据 status 提示。
 */
export async function cfsmPost<S extends z.ZodTypeAny>(
  path: string,
  body: unknown,
  schema: S,
  options?: RequestOptions,
): Promise<z.output<S>> {
  const base = options?.base ?? getPrimaryApiBase();
  const url = `${base}${path}`;
  const resp = await fetchWithTimeout(
    url,
    {
      method: "POST",
      credentials: "include",
      headers: { ...buildHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    options?.timeout ?? DEFAULT_API_TIMEOUT_MS,
    options?.signal,
  );

  if (!resp.ok) {
    const errorBody = await readErrorBody(resp);
    if (resp.status === 401) {
      // 令牌过期：清掉，让调用方提示重新登录（写操作没有匿名降级一说）。
      clearJwtToken();
    }
    if (resp.status === 403) {
      // Turnstile 凭证失效：清掉，全局 TurnstileGate 会在下次拉 config 时重新弹验证。
      clearTurnstileCredentials();
    }
    if (resp.status === 409 || errorBody?.message === "databaseUpgradeRequired") {
      throw new DatabaseUpgradeRequiredError(path);
    }
    const code = Number(errorBody?.code);
    throw new ApiRequestError(
      errorBody?.error || errorBody?.message || `Request ${path} failed: ${resp.status}`,
      resp.status,
      path,
      Number.isFinite(code) && code > 0 ? code : resp.status,
    );
  }

  const json = (await resp.json()) as unknown;
  captureTurnstileVerified(json);

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Schema mismatch on ${path}: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

export interface MultiBaseResult<T> {
  base: string;
  data?: T;
  error?: unknown;
}

/**
 * 向所有后端并发发起同一个 GET。单站失败不影响其它站，调用方自行决定如何合并
 * 与如何提示（多站部署下部分站点离线属于常态）。
 */
export async function cfsmGetAll<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options?: Omit<RequestOptions, "base">,
): Promise<MultiBaseResult<z.output<S>>[]> {
  const bases = getApiBases();

  // 消费超前预取的各站 /api/servers
  if (
    path === "/api/servers" &&
    !options?.signal &&
    typeof window !== "undefined"
  ) {
    const earlyWin = window as unknown as EarlyDataWindow;
    const earlyServers = earlyWin.__EARLY_DATA__?.servers;
    if (earlyServers && Array.isArray(earlyServers) && earlyServers.length > 0) {
      earlyWin.__EARLY_DATA__!.servers = null;
      try {
        const settled = await Promise.all(earlyServers.map((item) => item.promise));
        return settled.map((res) => {
          if (res.error || !res.data) {
            return { base: res.base, error: res.error || new Error("No data") };
          }
          const parsed = schema.safeParse(res.data);
          if (parsed.success) {
            return { base: res.base, data: parsed.data };
          }
          return {
            base: res.base,
            error: new Error(
              `Schema mismatch on /api/servers: ${parsed.error.issues[0]?.message ?? "unknown"}`,
            ),
          };
        });
      } catch {
        // 异常降级至标准请求
      }
    }
  }

  const settled = await Promise.allSettled(
    bases.map((base) => cfsmGet(path, schema, { ...options, base })),
  );

  return settled.map((result, index) => {
    const base = bases[index]!;
    return result.status === "fulfilled"
      ? { base, data: result.value }
      : { base, error: result.reason };
  });
}
