import { getJwtToken, toWebSocketBase } from "@/services/cfsm/config";

/**
 * `/api/ws` 实时推送客户端。
 *
 * 协议要点（见 theme-develop.md 第 3 节）：
 * - `?subscribe=all` 建连后必须再通过通道发送 `{type:"subscribe",scope:"all",ids}`，
 *   否则服务端不会推送任何更新；
 * - 只订阅一台（详情页）时用 `?subscribe=<serverId>`，不需要 ids，且后端对单服务器订阅
 *   不进 250ms 合并窗口、实时直推；ids 收敛到一台时自动切到该 scope 并重连（URL 参数
 *   只在建连时被服务端读取，无法在原连接上改）；
 * - 推送统一为 `batchUpdate`，样本对象可能落在 `data` / `payload` / `metrics` 任一字段；
 * - `ids` 最多 500 个，非法 `scope`/`ids` 会被以 close code 1008 断开——这种情况重连也没用。
 */

const MAX_SUBSCRIBE_IDS = 500;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const PING_INTERVAL_MS = 30_000;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
/** 服务端因参数非法主动关闭，重连不会有不同结果。 */
const POLICY_VIOLATION_CLOSE_CODE = 1008;

export interface WsSample {
  serverId: string;
  ts: number;
  data: Record<string, unknown>;
}

export interface WsClientHandlers {
  onBatch(samples: WsSample[]): void;
  /** 连接可用性变化；false 时调用方应回落到轮询。 */
  onAvailabilityChange(available: boolean): void;
}

export interface WsConnection {
  updateIds(ids: string[]): void;
  close(): void;
}

function sanitizeIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const value = String(id ?? "").trim();
    if (!ID_PATTERN.test(value)) continue;
    out.push(value);
    if (out.length >= MAX_SUBSCRIBE_IDS) break;
  }
  return out;
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/** 订阅 scope：只订阅一台（详情页）时用该 serverId，其余用全量 ids 过滤。 */
function scopeForIds(ids: string[]): string {
  return ids.length === 1 ? ids[0]! : "all";
}

function extractSamples(message: unknown): WsSample[] {
  if (!message || typeof message !== "object") return [];
  const payload = message as Record<string, unknown>;
  if (payload.type !== "batchUpdate" || !Array.isArray(payload.updates)) return [];

  const out: WsSample[] = [];
  for (const rawUpdate of payload.updates) {
    if (!rawUpdate || typeof rawUpdate !== "object") continue;
    const update = rawUpdate as Record<string, unknown>;
    const serverId = String(update.serverId ?? "").trim();
    if (!serverId || !Array.isArray(update.samples)) continue;

    for (const rawSample of update.samples) {
      if (!rawSample || typeof rawSample !== "object") continue;
      const sample = rawSample as Record<string, unknown>;
      const data = (sample.data ?? sample.payload ?? sample.metrics) as
        | Record<string, unknown>
        | undefined;
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      out.push({
        serverId,
        ts: Number(sample.ts ?? sample.timestamp ?? 0) || 0,
        data,
      });
    }
  }
  return out;
}

/**
 * `/api/ws` 的连接地址。私有站点里：同域靠登录后的 `cfsm_auth` Cookie；跨域（纯静态部署的主题）时
 * 浏览器原生 WebSocket 带不了 Authorization 头，只能把 JWT 放进查询参数 `token`（后端文档第 3 节）。
 * token 会进访问日志，所以只在 wss 上、且确实跨域时才带。
 */
export function buildWsUrl(
  base: string,
  token: string,
  pageHost: string,
  scope: string,
): string {
  const url = new URL(`${toWebSocketBase(base)}/api/ws`);
  url.searchParams.set("subscribe", scope);
  if (token && url.protocol === "wss:" && url.host !== pageHost) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

/**
 * 维持一条到指定后端的 WebSocket。断线自动指数退避重连；
 * 被 1008 关闭时停止重连并通知调用方降级。
 */
export function createWsConnection(
  base: string,
  initialIds: string[],
  handlers: WsClientHandlers,
): WsConnection {
  let ids = sanitizeIds(initialIds);
  let scope = scopeForIds(ids);
  // 当前这条 socket 建立时用的 scope，用于判断订阅是否从全量↔单台切换。
  let connectScope = scope;
  let socket: WebSocket | null = null;
  let pingTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  let closed = false;
  let available = false;

  function setAvailable(next: boolean) {
    if (available === next) return;
    available = next;
    handlers.onAvailabilityChange(next);
  }

  function clearTimers() {
    if (pingTimer != null) {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
    if (reconnectTimer != null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function sendSubscribe() {
    if (socket?.readyState !== WebSocket.OPEN || ids.length === 0) return;
    socket.send(JSON.stringify({ type: "subscribe", scope, ids }));
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer != null) return;
    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** Math.min(reconnectAttempts, 5),
    );
    reconnectAttempts += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (closed) return;
    // 记下这条连接建立时用的 scope：URL 的 subscribe 只在建连时被后端读取，
    // 全量↔单台切换必须重连才能让 subscribe 从 all 变成 <serverId>（见文档第 3 节）。
    connectScope = scope;
    try {
      // 每次（重）连都现算地址：期间可能登录 / 退出过，token 要跟着变。
      socket = new WebSocket(buildWsUrl(base, getJwtToken(), window.location.host, scope));
    } catch {
      setAvailable(false);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      reconnectAttempts = 0;
      sendSubscribe();
      setAvailable(true);
      pingTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        }
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const samples = extractSamples(parsed);
      if (samples.length > 0) handlers.onBatch(samples);
    };

    socket.onerror = () => {
      setAvailable(false);
    };

    socket.onclose = (event) => {
      clearTimers();
      socket = null;
      setAvailable(false);
      if (closed) return;
      if (event.code === POLICY_VIOLATION_CLOSE_CODE) {
        // 订阅参数被服务端拒绝，重连只会重复失败，交给轮询兜底。
        console.warn(`[LuminaPlus] WebSocket 订阅被拒绝 (1008)，已降级为轮询：${base}`);
        closed = true;
        return;
      }
      scheduleReconnect();
    };
  }

  connect();

  /**
   * 订阅在「全量 all」和「单台 <serverId>」之间切换时，重连一条新 socket。
   * 先摘掉旧 socket 的回调再关，避免旧连接的 onclose 触发多余的退避重连。
   */
  function reconnectForScopeChange() {
    clearTimers();
    const current = socket;
    socket = null;
    if (current) {
      current.onopen = null;
      current.onmessage = null;
      current.onerror = null;
      current.onclose = null;
      try {
        current.close();
      } catch {
        // 关闭旧连接失败不影响新建连接。
      }
    }
    reconnectAttempts = 0;
    connect();
  }

  return {
    updateIds(nextIds: string[]) {
      const sanitized = sanitizeIds(nextIds);
      if (sameIds(ids, sanitized)) return;
      ids = sanitized;
      scope = scopeForIds(ids);
      // 详情页只订阅一台 → subscribe=<id>；回到全站 → subscribe=all。URL 的 subscribe
      // 只能靠重连改，光发通道消息改不动后端建连时记下的 scope。
      if (scope !== connectScope) {
        reconnectForScopeChange();
        return;
      }
      sendSubscribe();
    },
    close() {
      closed = true;
      clearTimers();
      const current = socket;
      socket = null;
      setAvailable(false);
      current?.close();
    },
  };
}
