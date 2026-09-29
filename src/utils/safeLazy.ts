import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "cfsm_chunk_reload_ts";

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("dynamically imported module") ||
    message.includes("Failed to load module script") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
}

/**
 * 包装 React.lazy，当遭遇产物发布后旧 chunk 被删导致的动态导入失败时，
 * 自动刷新页面获取最新的 index.html 与 bundle，避免用户卡死在报错页。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeLazy<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (isChunkLoadError(error) && typeof window !== "undefined") {
        const now = Date.now();
        const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
        // 15 秒内最多自动刷新一次，避免网络真正断网时陷入死循环
        if (now - lastReload > 15_000) {
          sessionStorage.setItem(RELOAD_KEY, String(now));
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    }
  });
}
