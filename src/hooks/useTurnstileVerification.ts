import { useSyncExternalStore } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { getTurnstileVerified, subscribeTurnstileVerified } from "@/services/cfsm/config";
import type { PublicConfig } from "@/types/cfsm";

type TurnstileConfig = Pick<PublicConfig, "turnstile_enabled" | "verified" | "turnstile_site_key">;

/**
 * 站点开了全局人机验证、这次请求没通过、本机也没有缓存凭证 —— 这时数据接口一律 403。
 * 没有站点公钥时渲染不出验证组件，弹了也没法过，按不需要处理（老样子让请求自己报错）。
 */
export function needsTurnstileVerification(
  config: TurnstileConfig | undefined,
  cachedCredential: string,
): boolean {
  return (
    config?.turnstile_enabled === true &&
    config.verified !== true &&
    !cachedCredential &&
    Boolean(config.turnstile_site_key)
  );
}

/**
 * 验证弹窗出不出、数据页挂不挂，都看这一个口径（TurnstileGate 与 AppShell）。
 * 凭证订阅着读：验证一通过就翻成 false，不用等 `/api/config` 重新拉回来。
 */
export function useTurnstileVerificationRequired(): boolean {
  const { data: config } = usePublicConfig();
  const credential = useSyncExternalStore(
    subscribeTurnstileVerified,
    getTurnstileVerified,
    getTurnstileVerified,
  );
  return needsTurnstileVerification(config, credential);
}
