import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSettings } from "@/hooks/useThemeSettings";

const PRICE_VISIBILITY_OVERRIDE_KEY = "komaritheme:price-visibility-override";

export type PriceVisibilityOverride = "visible" | "hidden" | null;

const listeners = new Set<() => void>();

export function resolvePriceVisibility(
  loggedIn: boolean,
  showPriceForGuests: boolean,
  override: PriceVisibilityOverride,
): boolean {
  if (override === "hidden") return false;
  if (override === "visible") return loggedIn || showPriceForGuests;

  // 默认状态（未设置临时覆盖）：严格以「向访客公开价格与资产」为准。
  // 未勾选向访客公开时，默认全部隐藏价格与资产脱敏，彻底杜绝未登录访客默认泄露价格标签。
  // 管理员可随时通过右上角快捷按钮一键临时展开查看。
  return showPriceForGuests;
}

function readStoredOverride(): PriceVisibilityOverride {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PRICE_VISIBILITY_OVERRIDE_KEY);
    if (value === "visible" || value === "hidden") return value;
    return null;
  } catch {
    return null;
  }
}

let currentOverride: PriceVisibilityOverride = readStoredOverride();

function emit() {
  for (const listener of listeners) listener();
}

function writeStoredOverride(value: PriceVisibilityOverride) {
  currentOverride = value;
  try {
    if (value == null) {
      sessionStorage.removeItem(PRICE_VISIBILITY_OVERRIDE_KEY);
    } else {
      sessionStorage.setItem(PRICE_VISIBILITY_OVERRIDE_KEY, value);
    }
  } catch {
    // 忽略 sessionStorage 写入失败
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PriceVisibilityOverride {
  return currentOverride;
}

export function usePriceVisibility() {
  const { data: me } = useAuth();
  const themeSettings = useThemeSettings();
  const override = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const loggedIn = Boolean(me?.logged_in);

  const isPriceVisible = resolvePriceVisibility(
    loggedIn,
    themeSettings.showPriceForGuests,
    override,
  );

  const togglePriceVisibility = useCallback(() => {
    if (!loggedIn) return;
    const next = isPriceVisible ? "hidden" : "visible";
    writeStoredOverride(next);
  }, [loggedIn, isPriceVisible]);

  const setPriceVisible = useCallback(
    (visible: boolean) => {
      if (!loggedIn) return;
      writeStoredOverride(visible ? "visible" : "hidden");
    },
    [loggedIn],
  );

  const resetPriceVisibilityOverride = useCallback(() => {
    writeStoredOverride(null);
  }, []);

  return {
    isPriceVisible,
    canToggle: loggedIn,
    togglePriceVisibility,
    setPriceVisible,
    resetPriceVisibilityOverride,
  };
}
