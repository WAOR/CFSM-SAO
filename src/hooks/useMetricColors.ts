import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { clearCssColorCache } from "@/components/node/CanvasStrip";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useLocalThemeSettings } from "@/hooks/useThemeSettings";
import {
  getLocalThemeSettings,
  saveLocalThemeSettings,
} from "@/services/themeSettingsStore";

// 指标色和暗色深度存进主题设置（站点预设 + 本机覆盖），并通过 CSS 变量全局应用。

export type MetricColorKey =
  | "cpu"
  | "memory"
  | "disk"
  | "load"
  | "swap"
  | "speedIdle"
  | "speedLow"
  | "speedHigh"
  | "speedMax"
  | "trafficUp"
  | "trafficDown";

type MetricColorGroup = "metric" | "speed" | "traffic";

export const METRIC_COLOR_GROUPS: ReadonlyArray<{ id: MetricColorGroup; label: string }> = [
  { id: "metric", label: "卡片配色" },
  { id: "speed", label: "速率热力" },
  { id: "traffic", label: "流量方向" },
];

export const METRIC_COLOR_META: ReadonlyArray<{
  key: MetricColorKey;
  label: string;
  cssVar: string;
  group: MetricColorGroup;
}> = [
  { key: "cpu", label: "CPU", cssVar: "--progress-cpu", group: "metric" },
  { key: "memory", label: "内存", cssVar: "--progress-memory", group: "metric" },
  { key: "disk", label: "磁盘", cssVar: "--progress-disk", group: "metric" },
  { key: "load", label: "负载", cssVar: "--progress-load", group: "metric" },
  { key: "swap", label: "Swap", cssVar: "--progress-swap", group: "metric" },
  { key: "speedIdle", label: "超低速", cssVar: "--speed-idle", group: "speed" },
  { key: "speedLow", label: "低速", cssVar: "--speed-low", group: "speed" },
  { key: "speedHigh", label: "高速", cssVar: "--speed-high", group: "speed" },
  { key: "speedMax", label: "急速", cssVar: "--speed-max", group: "speed" },
  { key: "trafficUp", label: "上行", cssVar: "--traffic-up", group: "traffic" },
  { key: "trafficDown", label: "下行", cssVar: "--traffic-down", group: "traffic" },
];

type MetricColors = Partial<Record<MetricColorKey, string>>;

const SETTINGS_KEY = "metricColors";
const DARK_DEPTH_SETTINGS_KEY = "darkDepth";
const DARK_DEPTH_CACHE_KEY = "cfsm-luminaplus:dark-depth";
const HEX = /^#[0-9a-f]{6}$/;
/** 本机覆盖里「这个颜色不用站点色、回到主题默认色」的写法。 */
const UNSET_COLOR = "";
export const DEFAULT_DARK_DEPTH = 0;

export interface PaletteDraft {
  colors: MetricColors;
  darkDepth: number;
}

function toInputHex(value: string): string {
  let v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + [...v.slice(1)].map((c) => c + c).join("");
  return HEX.test(v) ? v : "#888888";
}

/** 从后端 theme_settings 解析出已保存的指标配色（校验 hex 与已知 key）。 */
function readMetricColorsFromSettings(
  settings: Record<string, unknown> | undefined,
): MetricColors {
  const raw = settings?.[SETTINGS_KEY];
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const out: MetricColors = {};
  for (const { key } of METRIC_COLOR_META) {
    const v = source[key];
    if (typeof v === "string" && HEX.test(v.toLowerCase())) out[key] = v.toLowerCase();
  }
  return out;
}

export function normalizeDarkDepth(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DARK_DEPTH;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

/** 缺省值 0 就是原有 Dark Dimmed 灰黑；只接受 0–100 的受限黑色深度。 */
export function readDarkDepthFromSettings(
  settings: Record<string, unknown> | undefined,
): number {
  return normalizeDarkDepth(settings?.[DARK_DEPTH_SETTINGS_KEY]);
}

function readPaletteDraft(settings: Record<string, unknown> | undefined): PaletteDraft {
  return {
    colors: readMetricColorsFromSettings(settings),
    darkDepth: readDarkDepthFromSettings(settings),
  };
}

/**
 * 站点预设叠上本机覆盖之后的配色。**颜色逐个叠**：本机只存和站点不一样的那几个，其余跟站点走。
 *
 * 不能像其它主题设置那样 `{...站点, ...本机}` 整键盖 —— metricColors 是一个对象，本机只要存过一个颜色，
 * 站点设的其它颜色就整个被盖掉；某个颜色点「恢复」也回不到站点色，只能回到主题默认色。
 * 暗色深度是单个数，本机设过就用本机的。
 */
function resolvePalette(
  site: Record<string, unknown> | undefined,
  local: Record<string, unknown> | undefined,
): PaletteDraft {
  const sitePalette = readPaletteDraft(site);
  const colors = { ...sitePalette.colors, ...readMetricColorsFromSettings(local) };
  // 本机写成空串的颜色 = 连站点色也不要、回到主题默认色（登录站长点「恢复」，见 pickPaletteOverrides）。
  const localRaw = local?.[SETTINGS_KEY];
  if (localRaw && typeof localRaw === "object") {
    for (const { key } of METRIC_COLOR_META) {
      if ((localRaw as Record<string, unknown>)[key] === UNSET_COLOR) delete colors[key];
    }
  }
  return {
    colors,
    darkDepth:
      local?.[DARK_DEPTH_SETTINGS_KEY] != null
        ? readDarkDepthFromSettings(local)
        : sitePalette.darkDepth,
  };
}

/**
 * 导出用：挑出配色相关的键（站点预设叠上本机覆盖，本机可省）。
 *
 * 设置页的「复制配置 JSON」走 normalizeThemeSettings，那是个白名单，认不得
 * metricColors / darkDepth，直接导出会把取色器里调的卡片配色丢掉。
 * 与默认值相同就不写进快照，避免站点预设里堆一堆无意义的键。
 */
export function pickPaletteSettings(
  site: Record<string, unknown> | undefined,
  local?: Record<string, unknown>,
): Record<string, unknown> {
  const { colors, darkDepth } = resolvePalette(site, local);
  const out: Record<string, unknown> = {};
  if (Object.keys(colors).length > 0) out[SETTINGS_KEY] = colors;
  if (darkDepth !== DEFAULT_DARK_DEPTH) out[DARK_DEPTH_SETTINGS_KEY] = darkDepth;
  return out;
}

/**
 * 编辑后的配色里哪些要落成本机覆盖：只留和站点预设不一样的颜色与暗色深度，一样的跟着站点走
 * （站长以后改站点配色，没动过那个颜色的设备才跟得上）。
 *
 * 暗色深度要和站点值比、不能和主题默认值比：站点预设是 60（深黑）时选「灰黑」(= 默认 0)，
 * 和默认值比会被判成「无需覆盖」而删掉本机键，值又弹回 60，表现为「灰黑点不上」。
 */
export function pickPaletteOverrides(
  next: PaletteDraft,
  site: PaletteDraft,
): Record<string, unknown> {
  const colors: MetricColors = {};
  for (const { key } of METRIC_COLOR_META) {
    const value = next.colors[key];
    if (value != null && value !== site.colors[key]) colors[key] = value;
    // 站点设了、编辑后没了：记成空串，否则逐色叠加时站点色又会冒回来。
    else if (value == null && site.colors[key] != null) colors[key] = UNSET_COLOR;
  }
  const out: Record<string, unknown> = {};
  if (Object.keys(colors).length > 0) out[SETTINGS_KEY] = colors;
  if (next.darkDepth !== site.darkDepth) out[DARK_DEPTH_SETTINGS_KEY] = next.darkDepth;
  return out;
}

// ---- 已应用配色：写 CSS 变量 + 维护 version 让 canvas 卡片即时重绘 ----
let version = 0;
let appliedSig = "__init__";
let appliedDarkDepth: number | null = null;
let rafId: number | null = null;
const listeners = new Set<() => void>();

// 编辑期间以本地预览为准，避免 public config 刷新闪回旧值。
let metricColorEditing = false;

function bumpVersionThrottled() {
  // 合并同一帧的取色事件，避免重复重绘所有卡片。
  if (rafId != null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    version += 1;
    for (const l of listeners) l();
  });
}

/** 把一组配色应用到 <html>（CSS 变量即时覆盖；canvas 经 version 重绘）。相同配色不重复应用。 */
function applyMetricColors(colors: MetricColors) {
  const sig = JSON.stringify(colors ?? {});
  if (sig === appliedSig) return;
  appliedSig = sig;
  const root = document.documentElement;
  for (const { key, cssVar } of METRIC_COLOR_META) {
    const v = colors[key];
    if (v) root.style.setProperty(cssVar, v);
    else root.style.removeProperty(cssVar);
  }
  clearCssColorCache();
  bumpVersionThrottled();
}

/** 只设置强度变量；亮色 token 不引用它，因此调整不会污染浅色模式。 */
function applyDarkDepth(value: number) {
  const depth = normalizeDarkDepth(value);
  if (depth === appliedDarkDepth) return;
  appliedDarkDepth = depth;
  const root = document.documentElement;
  if (depth === DEFAULT_DARK_DEPTH) root.style.removeProperty("--dark-depth");
  else root.style.setProperty("--dark-depth", String(depth));
  clearCssColorCache();
  bumpVersionThrottled();
  try {
    if (depth === DEFAULT_DARK_DEPTH) localStorage.removeItem(DARK_DEPTH_CACHE_KEY);
    else localStorage.setItem(DARK_DEPTH_CACHE_KEY, String(depth));
  } catch {
    // 首帧缓存失败不影响当前预览与后端设置。
  }
}

function applyPalette(palette: PaletteDraft) {
  applyMetricColors(palette.colors);
  applyDarkDepth(palette.darkDepth);
}

/** 供 canvas 卡片（NodeCard）订阅：配色变化时拼进 redrawKey 触发重绘。 */
export function useMetricColorsVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => version,
    () => version,
  );
}

/** 读取每个指标当前生效的 hex（含默认 token），供取色器显示初值。 */
export function readEffectiveColors(): Record<MetricColorKey, string> {
  const styles = getComputedStyle(document.documentElement);
  const out = {} as Record<MetricColorKey, string>;
  for (const { key, cssVar } of METRIC_COLOR_META) out[key] = toInputHex(styles.getPropertyValue(cssVar));
  return out;
}

/** 全局：把后端保存的配色应用到所有访客（在 AppShell 挂载一次）。 */
export function useMetricColorsSync() {
  const { data: config } = usePublicConfig();
  const localSettings = useLocalThemeSettings();
  // 站点预设打底，本机覆盖在上（逐个颜色叠，见 resolvePalette）。
  // 只读后端会把访客本机保存的配色冲掉（刷新即丢失）。
  const palette = useMemo(
    () => resolvePalette(config?.theme_settings, localSettings),
    [config?.theme_settings, localSettings],
  );
  // 站点预设可能定义了配色，config 到达前先保留 index.html 的首帧缓存；
  // 但本机已有覆盖时可以立即应用，不必等网络。
  const ready = config != null || Object.keys(localSettings).length > 0;
  useEffect(() => {
    if (!ready) return;
    if (metricColorEditing) return;
    applyPalette(palette);
  }, [palette, ready]);
}

/**
 * 编辑配色：即时预览并写入本机的主题设置。
 *
 * `syncsToSite`（登录站长）：本机改动随即自动同步到后端、同步完本机是空的，所以「恢复」「全部重置」
 * 不能再以站点预设为准 —— 否则同步一完两个按钮就永远灰着。站长改的就是站点配色，恢复 = 回到主题默认色。
 * 同步本身不在这里（useSiteThemeOptions 引用了本文件，反过来会成环），跟着本机存储的改动事件走。
 */
export function useMetricColorsEditor({ syncsToSite = false }: { syncsToSite?: boolean } = {}) {
  const { data: config } = usePublicConfig();
  const localSettings = useLocalThemeSettings();
  const savedPalette = useMemo(
    () => resolvePalette(config?.theme_settings, localSettings),
    [config?.theme_settings, localSettings],
  );

  // 站点预设里的配色。本机要存哪些、「恢复」恢复到哪，都和它比（见 pickPaletteOverrides）。
  const sitePaletteRef = useRef(readPaletteDraft(config?.theme_settings));
  sitePaletteRef.current = readPaletteDraft(config?.theme_settings);

  // 访客：本机覆盖过的颜色才能「恢复」（跟随站点预设的颜色没什么可恢复的）。
  const localOverriddenColors = useMemo(
    () => readMetricColorsFromSettings(localSettings),
    [localSettings],
  );
  // 访客：「全部重置」只看本机有没有存过配色 / 暗色深度覆盖（跟随站点预设时不该亮）。
  const hasLocalPaletteOverrides = useMemo(() => {
    const l = localSettings as Record<string, unknown> | undefined;
    return l?.[SETTINGS_KEY] != null || l?.[DARK_DEPTH_SETTINGS_KEY] != null;
  }, [localSettings]);
  const syncsToSiteRef = useRef(syncsToSite);
  syncsToSiteRef.current = syncsToSite;

  const [draft, setDraft] = useState<PaletteDraft>(savedPalette);
  const draftRef = useRef<PaletteDraft>(savedPalette);
  const savedPaletteRef = useRef<PaletteDraft>(savedPalette);

  // 非编辑状态才接受外部回流;同内容不重置以免多余渲染。
  useEffect(() => {
    if (metricColorEditing) return;
    if (JSON.stringify(savedPaletteRef.current) === JSON.stringify(savedPalette)) return;
    savedPaletteRef.current = savedPalette;
    draftRef.current = savedPalette;
    setDraft(savedPalette);
  }, [savedPalette]);

  // 组件卸载即结束编辑态，本地写入是同步的，没有需要补存的在途请求。
  useEffect(() => {
    return () => {
      metricColorEditing = false;
    };
  }, []);

  const commit = useCallback(
    (next: PaletteDraft) => {
      metricColorEditing = true;
      draftRef.current = next;
      setDraft(next);
      applyPalette(next); // 即时预览

      const nextSettings: Record<string, unknown> = { ...getLocalThemeSettings() };
      delete nextSettings[SETTINGS_KEY];
      delete nextSettings[DARK_DEPTH_SETTINGS_KEY];
      saveLocalThemeSettings({
        ...nextSettings,
        ...pickPaletteOverrides(next, sitePaletteRef.current),
      });
      savedPaletteRef.current = next;
      metricColorEditing = false;
    },
    [],
  );

  const setColor = useCallback(
    (key: MetricColorKey, hex: string) => {
      const v = hex.toLowerCase();
      if (HEX.test(v)) {
        commit({
          ...draftRef.current,
          colors: { ...draftRef.current.colors, [key]: v },
        });
      }
    },
    [commit],
  );

  // 「恢复」= 跟随站点预设的这个颜色；站点没设（或登录站长在改站点配色）才回到主题默认色。
  const resetColor = useCallback(
    (key: MetricColorKey) => {
      const colors = { ...draftRef.current.colors };
      const siteColor = syncsToSiteRef.current ? undefined : sitePaletteRef.current.colors[key];
      if (siteColor) colors[key] = siteColor;
      else delete colors[key];
      commit({ ...draftRef.current, colors });
    },
    [commit],
  );

  const setDarkDepth = useCallback(
    (value: number) => {
      commit({ ...draftRef.current, darkDepth: normalizeDarkDepth(value) });
    },
    [commit],
  );

  // 「全部重置」= 丢掉本机覆盖、整份跟随站点预设（配色与暗色深度）；登录站长是整份回到主题默认。
  const resetAll = useCallback(() => {
    if (syncsToSiteRef.current) {
      commit({ colors: {}, darkDepth: DEFAULT_DARK_DEPTH });
      return;
    }
    const site = sitePaletteRef.current;
    commit({ colors: { ...site.colors }, darkDepth: site.darkDepth });
  }, [commit]);

  return {
    colors: draft.colors,
    darkDepth: draft.darkDepth,
    // 哪些颜色的「恢复」可点、「全部重置」可不可点。登录站长以当前配色和主题默认比。
    overriddenColors: syncsToSite ? draft.colors : localOverriddenColors,
    setColor,
    resetColor,
    setDarkDepth,
    resetAll,
    hasLocalOverrides: syncsToSite
      ? Object.keys(draft.colors).length > 0 || draft.darkDepth !== DEFAULT_DARK_DEPTH
      : hasLocalPaletteOverrides,
    // 本地写入不会失败到需要提示的程度，保留字段以兼容调用方。
    saveError: false,
  };
}
