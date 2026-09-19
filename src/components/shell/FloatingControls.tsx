import { lazy, Suspense, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Grid3x3,
  LayoutGrid,
  List,
  Monitor,
  Palette,
  RefreshCw,
  Rows3,
  Settings,
  SlidersHorizontal,
  Sun,
  Moon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePreferences } from "@/hooks/usePreferences";
import { useViewMode } from "@/hooks/useViewMode";
import { useNodeStoreStatus } from "@/hooks/useNode";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { usePriceVisibility } from "@/hooks/usePriceVisibility";
import type { PingHistoryRefreshState } from "@/hooks/usePingHistoryRefresh";
import { getAdminUrl } from "@/services/cfsm/config";
import type { NodeViewMode, Appearance } from "@/utils/themeSettings";
import { clsx } from "clsx";

const MetricColorPicker = lazy(() =>
  import("./MetricColorPicker").then((module) => ({ default: module.MetricColorPicker })),
);

// 悬浮球切换按钮展示"下一档"的图标/文案(点击后会切到的视图),而不是当前视图——
// 与 ThemeManage 里 NODE_VIEW_MODE_OPTIONS 的图标语义保持一致。
const VIEW_MODE_META: Record<NodeViewMode, { icon: typeof LayoutGrid; label: string }> = {
  large: { icon: LayoutGrid, label: "大视图" },
  compact: { icon: Rows3, label: "小视图" },
  mini: { icon: Grid3x3, label: "迷你视图" },
  list: { icon: List, label: "列表视图" },
};

const NEXT_APPEARANCE: Record<Appearance, Appearance> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const APPEARANCE_META: Record<
  Appearance,
  { icon: typeof Sun; label: string; nextLabel: string }
> = {
  light: { icon: Sun, label: "浅色", nextLabel: "深色" },
  dark: { icon: Moon, label: "深色", nextLabel: "跟随系统" },
  system: { icon: Monitor, label: "跟随系统", nextLabel: "浅色" },
};

/**
 * 刷新按钮的悬浮说明。
 *
 * 这个按钮会逐台发 `/api/history/all`，成本不该藏着 —— 标题里把节点数写出来，
 * 点之前就知道要打多少个请求。
 */
function buildRefreshTitle({
  status,
  nodeCount,
  lastResult,
  lastRefreshedAt,
}: PingHistoryRefreshState): string {
  if (status === "loading") return `正在拉取 ${nodeCount} 台节点最近 1 小时的延迟历史…`;
  if (status === "warn") return "30 分钟内已经刷新过；确实要再拉一次就再点一下";
  if (status === "error") {
    return lastResult && lastResult.succeeded > 0
      ? `部分节点刷新失败（${lastResult.failed}/${lastResult.requested}），点击重试`
      : "刷新失败，点击重试";
  }

  const base = `刷新延迟数据：拉取 ${nodeCount} 台节点最近 1 小时的真实采样`;
  if (lastRefreshedAt == null) return base;

  const at = new Date(lastRefreshedAt).toLocaleTimeString("zh-CN", { hour12: false });
  const partial =
    lastResult && lastResult.failed > 0 ? `，${lastResult.failed} 台失败` : "";
  return `${base}\n上次刷新 ${at}${partial}`;
}

export interface RefreshAlertData {
  title: string;
  description: string;
  variant: "default" | "warning" | "destructive";
}

/** 刷新反馈提示：遵循 shadcn Alert 规范，提供有层次的标题与描述 */
export function buildRefreshAlert({
  status,
  lastResult,
  minutesSinceLastRefresh,
}: PingHistoryRefreshState): RefreshAlertData | null {
  if (status === "warn") {
    const ago =
      minutesSinceLastRefresh == null || minutesSinceLastRefresh < 1
        ? "刚刚"
        : `${minutesSinceLastRefresh} 分钟前`;
    return {
      title: "刷新过于频繁",
      description: `${ago}才刷新过，数据变动较小 · 再次点击仍会强制刷新`,
      variant: "warning",
    };
  }
  if (status === "done") {
    if (!lastResult) {
      return {
        title: "延迟数据已更新",
        description: "已成功同步服务器最新延迟指标",
        variant: "default",
      };
    }
    return {
      title: "延迟数据已更新",
      description:
        lastResult.failed > 0
          ? `已成功更新 ${lastResult.succeeded} 台 · ${lastResult.failed} 台失败`
          : `已成功同步全部 ${lastResult.succeeded} 台服务器`,
      variant: "default",
    };
  }
  if (status === "error") {
    return {
      title: "刷新失败",
      description: "同步节点延迟数据超时，点击刷新按钮可重试",
      variant: "destructive",
    };
  }
  return null;
}

export function FloatingControls({
  onExpandedChange,
  pingRefresh,
}: {
  onExpandedChange?: (expanded: boolean) => void;
  /** 由首页持有：刷新按钮和数据自检弹窗共用同一份状态，见 `Home.tsx`。 */
  pingRefresh: PingHistoryRefreshState;
}) {
  const { appearance, setAppearance } = usePreferences();
  const { mode, nextMode, toggleMode } = useViewMode();
  const { data: me } = useAuth();
  const themeSettings = useThemeSettings();
  const { isPriceVisible, togglePriceVisibility } = usePriceVisibility();
  const { failureStreak } = useNodeStoreStatus();
  const [collapsed, setCollapsed] = useState(true);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [colorsMounted, setColorsMounted] = useState(false);
  const settingsReady = themeSettings.isReady;
  const showAdmin = settingsReady && themeSettings.enableAdminButton;
  // 主题管理入口与配色取色器都仅对登录管理员开放（配色存后端、全局生效）。
  const loggedIn = Boolean(me?.logged_in);
  const showThemeManage = loggedIn;
  const showColorPicker = loggedIn;
  const showPriceToggle = loggedIn;
  const showSyncWarning = failureStreak >= 2;
  const hiddenTabIndex = collapsed ? -1 : undefined;
  const ToggleIcon = collapsed ? ChevronLeft : ChevronRight;
  const ViewIcon = VIEW_MODE_META[nextMode].icon;
  const currentAppearance = APPEARANCE_META[appearance] ?? APPEARANCE_META.system;
  const AppearanceIcon = currentAppearance.icon;

  const cycleAppearance = () => {
    setAppearance(NEXT_APPEARANCE[appearance] ?? "system");
  };

  // 只要不在最宽松的大卡默认态,就视为"已切换"，按钮保持高亮。
  const isReducedView = mode !== "large";
  useEffect(() => {
    onExpandedChange?.(false);
    return () => onExpandedChange?.(false);
  }, [onExpandedChange]);

  // 仅监听用户主动的滚轮/触摸滑动手势（wheel / touchmove），100% 免疫任何 DOM 尺寸变化或重排引发的 scroll 事件
  useEffect(() => {
    if (collapsed) return;

    const handleUserScroll = () => {
      setCollapsed(true);
      setColorsOpen(false);
      onExpandedChange?.(false);
    };

    window.addEventListener("wheel", handleUserScroll, { passive: true });
    window.addEventListener("touchmove", handleUserScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleUserScroll);
      window.removeEventListener("touchmove", handleUserScroll);
    };
  }, [collapsed, onExpandedChange]);

  const refreshTitle = buildRefreshTitle(pingRefresh);
  const refreshAlert = buildRefreshAlert(pingRefresh);
  const refreshDone = pingRefresh.status === "done";
  const refreshWarn = pingRefresh.status === "warn";

  const toggleControls = () => {
    // 收起快捷栏时同时结束子面板状态，避免下次展开时调色盘自动复现。
    const nextCollapsed = !collapsed;
    if (nextCollapsed) setColorsOpen(false);
    setCollapsed(nextCollapsed);
    onExpandedChange?.(!nextCollapsed);
  };

  return (
    <div
      className={clsx(
        "floating-controls",
        collapsed && "is-collapsed",
        showSyncWarning && "has-warning",
      )}
    >
      <div className="floating-controls-inner">
        <div className="floating-controls-row">
          <div className="floating-controls-actions" aria-hidden={collapsed}>
            {settingsReady && (
              <>
                <button
                  type="button"
                  onClick={cycleAppearance}
                  aria-label={`外观: ${currentAppearance.label} (点击切换为${currentAppearance.nextLabel})`}
                  title={`外观: ${currentAppearance.label} (点击切换为${currentAppearance.nextLabel})`}
                  tabIndex={hiddenTabIndex}
                  className={clsx(
                    "control-button grid h-9 w-9 place-items-center",
                    appearance !== "system" && "control-toggle is-active",
                  )}
                >
                  <AppearanceIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={toggleMode}
                  aria-label="切换卡片视图"
                  aria-pressed={isReducedView}
                  title={`临时切换到${VIEW_MODE_META[nextMode].label}`}
                  tabIndex={hiddenTabIndex}
                  className={clsx(
                    "control-button grid h-9 w-9 place-items-center",
                    isReducedView && "control-toggle is-active",
                  )}
                >
                  <ViewIcon size={16} />
                </button>
                {showPriceToggle && (
                  <button
                    type="button"
                    onClick={togglePriceVisibility}
                    aria-label={isPriceVisible ? "隐藏价格与资产" : "显示价格与资产"}
                    aria-pressed={!isPriceVisible}
                    title={isPriceVisible ? "临时隐藏价格与资产" : "临时显示价格与资产"}
                    tabIndex={hiddenTabIndex}
                    className={clsx(
                      "control-button grid h-9 w-9 place-items-center",
                      !isPriceVisible && "control-toggle is-active",
                    )}
                  >
                    {isPriceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                )}
                {showColorPicker && (
                  <button
                    type="button"
                    onClick={() => {
                      setColorsMounted(true);
                      setColorsOpen((value) => !value);
                    }}
                    aria-label="卡片配色"
                    aria-pressed={colorsOpen}
                    title="卡片配色"
                    tabIndex={hiddenTabIndex}
                    className={clsx(
                      "control-button grid h-9 w-9 place-items-center",
                      colorsOpen && "control-toggle is-active",
                    )}
                  >
                    <Palette size={16} />
                  </button>
                )}
              </>
            )}
            {showThemeManage && (
              <Link
                to="/?view=theme-manage"
                aria-label="主题设置"
                title="主题设置"
                tabIndex={hiddenTabIndex}
                className="control-button grid h-9 w-9 place-items-center"
              >
                <SlidersHorizontal size={16} />
              </Link>
            )}
            {showAdmin && (
              <a
                href={getAdminUrl()}
                aria-label={me?.logged_in ? "管理" : "后台登录"}
                title={me?.logged_in ? "管理" : "后台登录"}
                tabIndex={hiddenTabIndex}
                className="control-button grid h-9 w-9 place-items-center"
              >
                <Settings size={16} />
              </a>
            )}
          </div>
          <button
            type="button"
            className={clsx(
              "control-button floating-controls-refresh grid h-9 w-9 place-items-center",
              refreshDone && "is-refresh-done",
              refreshWarn && "is-refresh-warn",
              pingRefresh.status === "error" && "is-refresh-error",
            )}
            aria-label="刷新延迟数据"
            aria-busy={pingRefresh.status === "loading"}
            title={refreshTitle}
            disabled={pingRefresh.nodeCount === 0 || pingRefresh.status === "loading"}
            onClick={() => pingRefresh.refresh()}
          >
            {refreshDone ? (
              <Check size={16} />
            ) : refreshWarn ? (
              <AlertTriangle size={16} />
            ) : (
              <RefreshCw
                size={16}
                className={
                  pingRefresh.status === "loading"
                    ? "floating-controls-refresh-spin"
                    : undefined
                }
              />
            )}
          </button>
          <button
            type="button"
            className="control-button floating-controls-trigger grid h-9 w-9 place-items-center"
            aria-label={collapsed ? "展开快捷按钮" : "收起快捷按钮"}
            aria-expanded={!collapsed}
            onClick={toggleControls}
            title={collapsed ? "展开快捷按钮" : "收起快捷按钮"}
          >
            <ToggleIcon size={16} />
            {showSyncWarning && collapsed && (
              <span className="floating-controls-warning-dot" aria-hidden />
            )}
          </button>
        </div>
        {showColorPicker && colorsMounted && (
          <Suspense fallback={null}>
            <MetricColorPicker hidden={collapsed || !colorsOpen} />
          </Suspense>
        )}
        {refreshAlert && !colorsOpen && (
          <div
            className={clsx(
              "floating-controls-shadcn-alert pointer-events-none relative flex w-auto min-w-[280px] max-w-[340px] items-start gap-3 rounded-xl border p-3 shadow-lg shadow-black/5 backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-top-1 duration-200",
              refreshAlert.variant === "warning" && [
                "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100",
                "[&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
              ],
              refreshAlert.variant === "default" && [
                "border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100",
                "[&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
              ],
              refreshAlert.variant === "destructive" && [
                "border-red-500/35 bg-red-500/10 text-red-950 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100",
                "[&>svg]:text-red-600 dark:[&>svg]:text-red-400",
              ],
            )}
            role="alert"
          >
            {refreshAlert.variant === "default" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : refreshAlert.variant === "warning" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="flex-1 text-left min-w-0">
              <h5 className="text-xs font-semibold tracking-tight leading-none">{refreshAlert.title}</h5>
              <div className="mt-1 text-[11px] opacity-85 leading-normal font-normal">
                {refreshAlert.description}
              </div>
            </div>
          </div>
        )}
        {showSyncWarning && !collapsed && !colorsOpen && !refreshAlert && (
          <div
            className="floating-controls-shadcn-alert pointer-events-none relative flex w-auto min-w-[280px] max-w-[340px] items-start gap-3 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-red-950 shadow-lg shadow-black/5 backdrop-blur-md dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100 [&>svg]:text-red-600 dark:[&>svg]:text-red-400 animate-in fade-in-0 slide-in-from-top-1 duration-200"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <h5 className="text-xs font-semibold tracking-tight leading-none">实时状态同步异常</h5>
              <div className="mt-1 text-[11px] opacity-85 leading-normal font-normal">
                网络连接波动，当前展示的是最近本地缓存
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
