import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useTurnstileVerificationRequired } from "@/hooks/useTurnstileVerification";
import { getSiteConfig } from "@/services/api";
import { discardEarlyData } from "@/services/cfsm/http";
import {
  clearTurnstileToken,
  getTurnstileVerified,
  setTurnstileToken,
  subscribeTurnstileCredentialsCleared,
} from "@/services/cfsm/config";

/**
 * Turnstile 人机验证。
 *
 * 站点开启全局 API 验证后，未携带验证凭证的请求会被后端以 403 拒绝，主题必须自己完成一次
 * 验证：渲染 Turnstile 组件 → 拿到一次性 token → 带着它请求 `/api/config` →
 * 响应里的 `turnstile_verified` 是加密凭证，缓存约一小时，后续请求复用（见 http.ts）。
 */
export function TurnstileGate() {
  const { data: config } = usePublicConfig();
  const queryClient = useQueryClient();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // 凭证过期后，首页轮询、保存到后端等请求会被 403，http 层清掉凭证并通知这里：重新拉 config，
  // 让下面的判断拿到 `verified: false`，弹窗重新出来。
  useEffect(
    () =>
      subscribeTurnstileCredentialsCleared(() => {
        void queryClient.invalidateQueries({ queryKey: ["public"] });
      }),
    [queryClient],
  );

  // 已经拿到缓存凭证或本次请求已通过验证时不打扰用户。AppShell 用同一个口径决定数据页挂不挂。
  const needsVerification = useTurnstileVerificationRequired();

  const resetTurnstile = useCallback(() => {
    clearTurnstileToken();
    setError(null);
    try {
      turnstileRef.current?.reset();
    } catch {
      // 忽略未就绪时的重置异常
    }
  }, []);

  const submitToken = useCallback(
    async (token: string) => {
      setVerifying(true);
      setError(null);
      try {
        // 预取的 config 与 servers 是验证前拉的（未通过验证），必须先丢掉 —— 否则
        // 验证通过后重拉数据会直接吃到 403 失败的脏缓存。
        discardEarlyData();
        // 带上一次性 token 请求 config，成功后 http 层会把返回的凭证缓存下来。
        setTurnstileToken(token);
        const newConfig = await getSiteConfig();
        // 优先认接口返回的实际 verified 状态，辅以凭证判定（兼容无痕模式 localStorage 受限）
        if (!newConfig.verified && !getTurnstileVerified()) {
          throw new Error("验证未通过，请重试");
        }
        await queryClient.invalidateQueries();
      } catch (submitError) {
        clearTurnstileToken();
        setError(submitError instanceof Error ? submitError.message : "验证失败");
        try {
          turnstileRef.current?.reset();
        } catch {
          // 忽略重置异常
        }
      } finally {
        setVerifying(false);
      }
    },
    [queryClient],
  );

  if (!needsVerification || !config?.turnstile_site_key) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--bg-0)/90 backdrop-blur-sm">
      <div className="surface-inset flex w-[min(22rem,90vw)] flex-col items-center gap-4 px-6 py-7 text-center">
        <div className="space-y-1.5">
          <div className="text-[15px] font-semibold text-(--text-primary)">
            请完成人机验证
          </div>
          <p className="text-[13px] text-(--text-secondary)">
            本站开启了 Cloudflare Turnstile 验证，通过后即可查看节点数据。
          </p>
        </div>

        <div className="flex min-h-16.25 items-center justify-center">
          <Turnstile
            ref={turnstileRef}
            siteKey={config.turnstile_site_key}
            options={{
              theme: "auto",
              retry: "auto",
              retryInterval: 5000,
              refreshExpired: "auto",
            }}
            onSuccess={(token) => {
              void submitToken(token);
            }}
            onError={() => {
              clearTurnstileToken();
              setError("人机验证异常，正在尝试自动恢复或请点击重试");
            }}
            onExpire={() => {
              clearTurnstileToken();
              setError("验证已过期，请重新完成验证");
            }}
          />
        </div>

        {verifying && (
          <div className="flex items-center gap-2 text-[12px] text-(--text-secondary)">
            <Spinner size={16} />
            <span>正在校验凭证...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2">
            <p role="alert" className="text-[12px] text-(--status-error)">
              {error}
            </p>
            <button
              type="button"
              onClick={resetTurnstile}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-(--text-secondary) hover:text-(--text-primary) transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              重新验证
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
