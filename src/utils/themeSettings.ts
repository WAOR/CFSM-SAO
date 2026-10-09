import type {
  PingLatencyColors,
  PingLatencyThresholds,
  PingLossColors,
  PingLossThresholds,
  ThemeSettings,
  TrafficSpectrumColors,
  UserMatrixPreset,
} from "@/types/cfsm";
import {
  DEFAULT_COST_RATE_API_URL,
  normalizeCostIgnoredNodes,
  normalizeCostPremiums,
  normalizeCostRateApiUrl,
  type CostPremiumEntry,
} from "@/utils/cost";
import { normalizeNodeIdentityList } from "@/utils/nodeIdentity";
import { normalizeHomeGroupOrder } from "@/utils/homeNodes";
import {
  HOME_SORT_NATURAL_DIRECTION,
  isHomeSortDirection,
  isHomeSortField,
  type HomeSortDirection,
  type HomeSortField,
} from "@/utils/homeSort";
import {
  DEFAULT_HOMEPAGE_MULTI_PING_TASK_IDS,
  DEFAULT_HOMEPAGE_PING_TASK_ID,
  resolveDefaultHomepagePingTaskId,
  normalizeHomepageMultiPingTaskIds,
  normalizeHomepagePingTaskBindings,
  type HomepagePingTaskBindings,
} from "@/utils/pingTasks";
import {
  EMPTY_PING_LINE_OVERRIDES_BY_NODE,
  normalizePingLineOverridesByNode,
  type PingLineOverridesByNode,
} from "@/utils/pingLineOverrides";

export type Appearance = "system" | "light" | "dark";
export type NodeViewMode = "large" | "compact" | "mini" | "list";
export type ClusterOverviewMode = "classic" | "nodes";
export type MatrixColorTheme =
  | "default"
  | "eva"
  | "cyberpunk"
  | "divergence";

export const MATRIX_COLOR_THEMES: readonly MatrixColorTheme[] = [
  "default",
  "eva",
  "cyberpunk",
  "divergence",
] as const;

export type MatrixBootEffect =
  | "laser-scan"
  | "digital-rain"
  | "cyber-glitch"
  | "divergence-flux";

export const MATRIX_BOOT_EFFECTS: readonly MatrixBootEffect[] = [
  "laser-scan",
  "digital-rain",
  "cyber-glitch",
  "divergence-flux",
] as const;


export const DEFAULT_PING_LATENCY_THRESHOLDS: PingLatencyThresholds = {
  excellent: 60,
  good: 100,
  moderate: 160,
  elevated: 200,
};

export const DEFAULT_PING_LATENCY_COLORS: PingLatencyColors = {
  excellent: "#10b981",
  good: "#84cc16",
  moderate: "#eab308",
  elevated: "#f59e0b",
  critical: "#ef4444",
};

export const DEFAULT_PING_LOSS_THRESHOLDS: PingLossThresholds = {
  low: 3,
  medium: 10,
};

export const DEFAULT_PING_LOSS_COLORS: PingLossColors = {
  zero: "#10b981",
  low: "#eab308",
  medium: "#f97316",
  high: "#ef4444",
};

export interface StatusBarPreset {
  id: string;
  name: string;
  colors: TrafficSpectrumColors;
  latencyColors: PingLatencyColors;
  lossColors: PingLossColors;
}

export type TrafficSpectrumPreset = StatusBarPreset;

export const DEFAULT_TRAFFIC_SPECTRUM_COLORS: TrafficSpectrumColors = {
  start: "#10b981",
  mid: "#eab308",
  high: "#f97316",
  end: "#ef4444",
};

export const STATUS_BAR_PRESETS: readonly StatusBarPreset[] = [
  {
    id: "classic",
    name: "经典运维 (翡翠绿 · 琥珀黄 · 警示橙 · 熔岩红)",
    colors: { start: "#10b981", mid: "#eab308", high: "#f97316", end: "#ef4444" },
    latencyColors: {
      excellent: "#10b981",
      good: "#84cc16",
      moderate: "#eab308",
      elevated: "#f97316",
      critical: "#ef4444",
    },
    lossColors: {
      zero: "#10b981",
      low: "#eab308",
      medium: "#f97316",
      high: "#ef4444",
    },
  },
  {
    id: "icefire",
    name: "深邃冰火 (冰川蓝 · 暮光紫 · 烈焰橙 · 绝境红)",
    colors: { start: "#06b6d4", mid: "#8b5cf6", high: "#f97316", end: "#ef4444" },
    latencyColors: {
      excellent: "#06b6d4",
      good: "#3b82f6",
      moderate: "#8b5cf6",
      elevated: "#f97316",
      critical: "#ef4444",
    },
    lossColors: {
      zero: "#06b6d4",
      low: "#8b5cf6",
      medium: "#f97316",
      high: "#ef4444",
    },
  },
  {
    id: "marine",
    name: "深海青翠 (薄荷青 · 蔚蓝海 · 暖杏黄 · 珊瑚红)",
    colors: { start: "#14b8a6", mid: "#0284c7", high: "#f59e0b", end: "#ef4444" },
    latencyColors: {
      excellent: "#14b8a6",
      good: "#06b6d4",
      moderate: "#0284c7",
      elevated: "#f59e0b",
      critical: "#ef4444",
    },
    lossColors: {
      zero: "#14b8a6",
      low: "#0284c7",
      medium: "#f59e0b",
      high: "#ef4444",
    },
  },
] as const;

export const TRAFFIC_SPECTRUM_PRESETS: readonly StatusBarPreset[] = STATUS_BAR_PRESETS;

export interface ResolvedThemeSettings {
  defaultAppearance: Appearance;
  desktopNodeViewMode: NodeViewMode;
  mobileNodeViewMode: NodeViewMode;
  clusterOverviewMode: ClusterOverviewMode;
  matrixColorTheme: MatrixColorTheme;
  matrixMockFill: boolean;
  matrixBootAnimation: boolean;
  matrixBootEffect: MatrixBootEffect;
  matrixCustomPattern: number[] | null;
  matrixUserPresets: UserMatrixPreset[];
  enableAdminButton: boolean;
  showPingChart: boolean;
  homepagePingBindings: HomepagePingTaskBindings;
  homepageDefaultPingTaskId: number;
  enableHomepageMultiPing: boolean;
  homepageMultiPingTaskIds: number[];
  homepagePingLineOverrides: PingLineOverridesByNode;
  fakePingForUnbound: boolean;
  pingLatencyThresholds: PingLatencyThresholds;
  pingLatencyColors: PingLatencyColors;
  pingLossThresholds: PingLossThresholds;
  pingLossColors: PingLossColors;
  trafficSpectrumColors: TrafficSpectrumColors;
  showHomeOverview: boolean;
  /** 顶部总览里的「资产概览」卡（把每月花多少钱亮给所有访客，单独给个开关）。 */
  showAssetOverview: boolean;
  showGroupTabs: boolean;
  showRegionBar: boolean;
  showCardGroup: boolean;
  showCardPrice: boolean;
  homeGroupOrder: string[];
  /** 首页默认选中的分组（空 = 全部）。后端没有这个分组时回退到全部。 */
  homeDefaultGroup: string;
  enableHomeSort: boolean;
  homeSortField: HomeSortField;
  homeSortDirection: HomeSortDirection;
  /** 离线节点排最前面；默认 false = 置底。 */
  offlineNodesFirst: boolean;
  /** 自定义管理员问候昵称（留空时自动读取后台用户名）。 */
  adminNickname: string;
  showCostSummary: boolean;
  showCostSummaryFloatingButton: boolean;
  showPriceForGuests: boolean;
  showOverviewRatings: boolean;
  showBandwidthRating: boolean;
  showAssetRating: boolean;
  bandwidthRatingLabels: string;
  assetRatingLabels: string;
  compactShowTrafficTotal: boolean;
  compactShowBilling: boolean;
  compactShowUptime: boolean;
  showConnections: boolean;
  hiddenNodes: string[];
  costIgnoredNodes: string[];
  costPremiums: Record<string, CostPremiumEntry>;
  costRateApiUrl: string;
}

export const DEFAULT_THEME_SETTINGS: ResolvedThemeSettings = {
  defaultAppearance: "system",
  desktopNodeViewMode: "large",
  mobileNodeViewMode: "compact",
  clusterOverviewMode: "classic",
  matrixColorTheme: "default",
  matrixMockFill: false,
  matrixBootAnimation: true,
  matrixBootEffect: "laser-scan",
  matrixCustomPattern: null,
  matrixUserPresets: [],
  enableAdminButton: true,
  showPingChart: true,
  homepagePingBindings: {},
  homepageDefaultPingTaskId: DEFAULT_HOMEPAGE_PING_TASK_ID,
  enableHomepageMultiPing: true,
  homepageMultiPingTaskIds: [...DEFAULT_HOMEPAGE_MULTI_PING_TASK_IDS],
  homepagePingLineOverrides: EMPTY_PING_LINE_OVERRIDES_BY_NODE,
  fakePingForUnbound: false,
  pingLatencyThresholds: DEFAULT_PING_LATENCY_THRESHOLDS,
  pingLatencyColors: DEFAULT_PING_LATENCY_COLORS,
  pingLossThresholds: DEFAULT_PING_LOSS_THRESHOLDS,
  pingLossColors: DEFAULT_PING_LOSS_COLORS,
  trafficSpectrumColors: DEFAULT_TRAFFIC_SPECTRUM_COLORS,
  showHomeOverview: true,
  showAssetOverview: true,
  showGroupTabs: true,
  showRegionBar: true,
  showCardGroup: true,
  showCardPrice: true,
  homeGroupOrder: [],
  homeDefaultGroup: "",
  enableHomeSort: true,
  homeSortField: "default",
  homeSortDirection: HOME_SORT_NATURAL_DIRECTION.default,
  offlineNodesFirst: false,
  adminNickname: "",
  showCostSummary: true,
  showCostSummaryFloatingButton: true,
  showPriceForGuests: false,
  showOverviewRatings: true,
  showBandwidthRating: true,
  showAssetRating: false,
  bandwidthRatingLabels: "",
  assetRatingLabels: "",
  compactShowTrafficTotal: true,
  compactShowBilling: true,
  compactShowUptime: true,
  showConnections: false,
  hiddenNodes: [],
  costIgnoredNodes: [],
  costPremiums: {},
  costRateApiUrl: DEFAULT_COST_RATE_API_URL,
};

/** 首页默认分组：只收非空字符串，长度掐在合理范围内（分组名来自后端）。 */
function normalizeHomeDefaultGroup(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 120) : "";
}

export function isAppearance(value: unknown): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * 后台「外观设置 → 默认外观」（`/api/config` 的 `preferred_theme`：auto / dark / light）→ 主题的外观值。
 * 缺席或认不出返回 undefined：老后端不下发，交给主题自己的默认（跟随系统）。
 */
export function resolvePreferredAppearance(value: unknown): Appearance | undefined {
  if (value === "dark" || value === "light") return value;
  if (value === "auto") return "system";
  return undefined;
}

/**
 * 把后台「默认外观」垫在主题设置的最底层：theme_options 或本机设置里写了 `defaultAppearance`
 * 就压过它。站长在后台改默认外观，没专门给主题配过外观的站点就会跟着走。
 */
export function withPreferredAppearance<T extends Record<string, unknown>>(
  preferred: Appearance | undefined,
  settings: T,
): T {
  return preferred ? ({ defaultAppearance: preferred, ...settings } as T) : settings;
}

function normalizeAppearance(
  value: unknown,
  fallback: Appearance = DEFAULT_THEME_SETTINGS.defaultAppearance,
): Appearance {
  return isAppearance(value) ? value : fallback;
}

export function isNodeViewMode(value: unknown): value is NodeViewMode {
  return value === "large" || value === "compact" || value === "mini" || value === "list";
}

function normalizeNodeViewMode(
  value: unknown,
  fallback: NodeViewMode,
): NodeViewMode {
  if (isNodeViewMode(value)) return value;
  // 未知旧字符串统一落到小卡，避免升级后出现无选中项。
  return typeof value === "string" && value.length > 0 ? "compact" : fallback;
}

function normalizeMobileNodeViewMode(
  value: unknown,
  fallback: NodeViewMode,
): NodeViewMode {
  const mode = normalizeNodeViewMode(value, fallback);
  return mode === "list" ? fallback : mode;
}

export function isClusterOverviewMode(value: unknown): value is ClusterOverviewMode {
  return value === "classic" || value === "nodes";
}

function normalizeClusterOverviewMode(
  value: unknown,
  fallback: ClusterOverviewMode = DEFAULT_THEME_SETTINGS.clusterOverviewMode,
): ClusterOverviewMode {
  if (value === "traffic") return "classic";
  if (value === "carousel") return "nodes";
  return isClusterOverviewMode(value) ? value : fallback;
}

export function isMatrixColorTheme(value: unknown): value is MatrixColorTheme {
  return typeof value === "string" && (MATRIX_COLOR_THEMES as readonly string[]).includes(value);
}

function normalizeMatrixColorTheme(
  value: unknown,
  fallback: MatrixColorTheme = DEFAULT_THEME_SETTINGS.matrixColorTheme,
): MatrixColorTheme {
  return isMatrixColorTheme(value) ? value : fallback;
}

function normalizeMatrixMockFill(value: unknown): boolean {
  return value === true;
}

export function normalizeMatrixBootAnimation(value: unknown): boolean {
  return value !== false;
}

export function isMatrixBootEffect(value: unknown): value is MatrixBootEffect {
  return typeof value === "string" && (MATRIX_BOOT_EFFECTS as readonly string[]).includes(value);
}

export function normalizeMatrixBootEffect(
  value: unknown,
  fallback: MatrixBootEffect = DEFAULT_THEME_SETTINGS.matrixBootEffect,
): MatrixBootEffect {
  return isMatrixBootEffect(value) ? value : fallback;
}

export function normalizeMatrixCustomPattern(val: unknown): number[] | null {
  if (!Array.isArray(val)) return null;
  const valid = val.filter(
    (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 100,
  );
  return Array.from(new Set(valid)).sort((a, b) => a - b);
}

export function normalizeMatrixUserPresets(val: unknown): UserMatrixPreset[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter(
      (item): item is UserMatrixPreset =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as UserMatrixPreset).id === "string" &&
            typeof (item as UserMatrixPreset).name === "string" &&
            Array.isArray((item as UserMatrixPreset).indices),
        ),
    )
    .map((item) => ({
      id: String(item.id),
      name: String(item.name).trim().slice(0, 24) || "自定义预设",
      indices: Array.from(
        new Set(
          item.indices.filter(
            (idx): idx is number =>
              typeof idx === "number" && Number.isInteger(idx) && idx >= 0 && idx < 100,
          ),
        ),
      ).sort((a, b) => a - b),
      createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    }))
    .slice(0, 12);
}

function enabledUnlessFalse(value: unknown) {
  return value !== false;
}

function normalizePlainText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeHomeSortDefault(
  field: unknown,
  direction: unknown,
): { homeSortField: HomeSortField; homeSortDirection: HomeSortDirection } {
  const homeSortField = isHomeSortField(field) ? field : "default";
  return {
    homeSortField,
    homeSortDirection: isHomeSortDirection(direction)
      ? direction
      : HOME_SORT_NATURAL_DIRECTION[homeSortField],
  };
}


function isValidHexColor(val: unknown): val is string {
  return typeof val === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val.trim());
}

export function normalizePingLatencyThresholds(val: unknown): PingLatencyThresholds {
  const defaults = DEFAULT_PING_LATENCY_THRESHOLDS;
  if (!val || typeof val !== "object") return defaults;
  const raw = val as Record<string, unknown>;
  const e = typeof raw.excellent === "number" && Number.isFinite(raw.excellent) && raw.excellent > 0
    ? Math.round(raw.excellent)
    : defaults.excellent;
  const g = typeof raw.good === "number" && Number.isFinite(raw.good) && raw.good > e
    ? Math.round(raw.good)
    : Math.max(e + 10, defaults.good);
  const m = typeof raw.moderate === "number" && Number.isFinite(raw.moderate) && raw.moderate > g
    ? Math.round(raw.moderate)
    : Math.max(g + 10, defaults.moderate);
  const el = typeof raw.elevated === "number" && Number.isFinite(raw.elevated) && raw.elevated > m
    ? Math.round(raw.elevated)
    : Math.max(m + 10, defaults.elevated);
  return { excellent: e, good: g, moderate: m, elevated: el };
}

export function normalizePingLatencyColors(val: unknown): PingLatencyColors {
  const defaults = DEFAULT_PING_LATENCY_COLORS;
  if (!val || typeof val !== "object") return defaults;
  const raw = val as Record<string, unknown>;
  return {
    excellent: isValidHexColor(raw.excellent) ? raw.excellent.toLowerCase() : defaults.excellent,
    good: isValidHexColor(raw.good) ? raw.good.toLowerCase() : defaults.good,
    moderate: isValidHexColor(raw.moderate) ? raw.moderate.toLowerCase() : defaults.moderate,
    elevated: isValidHexColor(raw.elevated) ? raw.elevated.toLowerCase() : defaults.elevated,
    critical: isValidHexColor(raw.critical) ? raw.critical.toLowerCase() : defaults.critical,
  };
}

export function normalizePingLossThresholds(val: unknown): PingLossThresholds {
  const defaults = DEFAULT_PING_LOSS_THRESHOLDS;
  if (!val || typeof val !== "object") return defaults;
  const raw = val as Record<string, unknown>;
  const low = typeof raw.low === "number" && Number.isFinite(raw.low) && raw.low > 0 && raw.low <= 100
    ? Number(raw.low.toFixed(1))
    : defaults.low;
  const medium = typeof raw.medium === "number" && Number.isFinite(raw.medium) && raw.medium > low && raw.medium <= 100
    ? Number(raw.medium.toFixed(1))
    : Math.max(low + 1, defaults.medium);
  return { low, medium };
}

export function normalizePingLossColors(val: unknown): PingLossColors {
  const defaults = DEFAULT_PING_LOSS_COLORS;
  if (!val || typeof val !== "object") return defaults;
  const raw = val as Record<string, unknown>;
  return {
    zero: isValidHexColor(raw.zero) ? raw.zero.toLowerCase() : defaults.zero,
    low: isValidHexColor(raw.low) ? raw.low.toLowerCase() : defaults.low,
    medium: isValidHexColor(raw.medium) ? raw.medium.toLowerCase() : defaults.medium,
    high: isValidHexColor(raw.high) ? raw.high.toLowerCase() : defaults.high,
  };
}

export function normalizeTrafficSpectrumColors(val: unknown): TrafficSpectrumColors {
  const defaults = DEFAULT_TRAFFIC_SPECTRUM_COLORS;
  if (!val || typeof val !== "object") return defaults;
  const raw = val as Record<string, unknown>;
  return {
    start: isValidHexColor(raw.start) ? raw.start.toLowerCase() : defaults.start,
    mid: isValidHexColor(raw.mid) ? raw.mid.toLowerCase() : defaults.mid,
    high: isValidHexColor(raw.high) ? raw.high.toLowerCase() : defaults.high,
    end: isValidHexColor(raw.end) ? raw.end.toLowerCase() : defaults.end,
  };
}

export function normalizeThemeSettings(
  settings: (ThemeSettings & Record<string, unknown>) | null | undefined,
): ResolvedThemeSettings {
  const homepageMultiPingTaskIds =
    settings?.homepageMultiPingTaskIds == null
      ? [...DEFAULT_HOMEPAGE_MULTI_PING_TASK_IDS]
      : normalizeHomepageMultiPingTaskIds(settings.homepageMultiPingTaskIds);
  return {
    defaultAppearance: normalizeAppearance(settings?.defaultAppearance),
    desktopNodeViewMode: normalizeNodeViewMode(
      settings?.desktopNodeViewMode,
      DEFAULT_THEME_SETTINGS.desktopNodeViewMode,
    ),
    mobileNodeViewMode: normalizeMobileNodeViewMode(
      settings?.mobileNodeViewMode,
      DEFAULT_THEME_SETTINGS.mobileNodeViewMode,
    ),
    clusterOverviewMode: normalizeClusterOverviewMode(settings?.clusterOverviewMode),
    matrixColorTheme: normalizeMatrixColorTheme(settings?.matrixColorTheme),
    matrixMockFill: normalizeMatrixMockFill(settings?.matrixMockFill),
    matrixBootAnimation: normalizeMatrixBootAnimation(settings?.matrixBootAnimation),
    matrixBootEffect: normalizeMatrixBootEffect(settings?.matrixBootEffect),
    matrixCustomPattern: normalizeMatrixCustomPattern(settings?.matrixCustomPattern),
    matrixUserPresets: normalizeMatrixUserPresets(settings?.matrixUserPresets),
    enableAdminButton: enabledUnlessFalse(settings?.enableAdminButton),
    showPingChart: enabledUnlessFalse(settings?.showPingChart),
    homepagePingBindings: normalizeHomepagePingTaskBindings(settings?.homepagePingBindings),
    homepageDefaultPingTaskId: resolveDefaultHomepagePingTaskId(
      settings?.homepageDefaultPingTaskId,
    ),
    enableHomepageMultiPing: enabledUnlessFalse(settings?.enableHomepageMultiPing),
    homepageMultiPingTaskIds,
    homepagePingLineOverrides: normalizePingLineOverridesByNode(settings?.homepagePingLineOverrides),
    fakePingForUnbound: settings?.fakePingForUnbound === true,
    pingLatencyThresholds: normalizePingLatencyThresholds(settings?.pingLatencyThresholds),
    pingLatencyColors: normalizePingLatencyColors(settings?.pingLatencyColors),
    pingLossThresholds: normalizePingLossThresholds(settings?.pingLossThresholds),
    pingLossColors: normalizePingLossColors(settings?.pingLossColors),
    trafficSpectrumColors: normalizeTrafficSpectrumColors(settings?.trafficSpectrumColors),
    showHomeOverview: enabledUnlessFalse(settings?.showHomeOverview),
    showAssetOverview: true,
    showGroupTabs: enabledUnlessFalse(settings?.showGroupTabs),
    showRegionBar: enabledUnlessFalse(settings?.showRegionBar),
    showCardGroup: enabledUnlessFalse(settings?.showCardGroup),
    showCardPrice: enabledUnlessFalse(settings?.showCardPrice),
    homeGroupOrder: normalizeHomeGroupOrder(settings?.homeGroupOrder),
    homeDefaultGroup: normalizeHomeDefaultGroup(settings?.homeDefaultGroup),
    enableHomeSort: enabledUnlessFalse(settings?.enableHomeSort),
    ...normalizeHomeSortDefault(settings?.homeSortField, settings?.homeSortDirection),
    offlineNodesFirst: settings?.offlineNodesFirst === true,
    adminNickname: normalizePlainText(settings?.adminNickname).trim().slice(0, 40),
    showCostSummary: enabledUnlessFalse(settings?.showCostSummary),
    showCostSummaryFloatingButton: enabledUnlessFalse(settings?.showCostSummaryFloatingButton),
    showPriceForGuests: settings?.showPriceForGuests === true,
    showOverviewRatings: enabledUnlessFalse(settings?.showOverviewRatings),
    showBandwidthRating: enabledUnlessFalse(settings?.showBandwidthRating),
    showAssetRating: settings?.showAssetRating === true,
    bandwidthRatingLabels: normalizePlainText(settings?.bandwidthRatingLabels),
    assetRatingLabels: normalizePlainText(settings?.assetRatingLabels),
    compactShowTrafficTotal: enabledUnlessFalse(settings?.compactShowTrafficTotal),
    compactShowBilling: enabledUnlessFalse(settings?.compactShowBilling),
    compactShowUptime: enabledUnlessFalse(settings?.compactShowUptime),
    showConnections: settings?.showConnections === true,
    hiddenNodes: normalizeNodeIdentityList(settings?.hiddenNodes),
    costIgnoredNodes: normalizeCostIgnoredNodes(settings?.costIgnoredNodes),
    costPremiums: normalizeCostPremiums(settings?.costPremiums),
    costRateApiUrl: normalizeCostRateApiUrl(settings?.costRateApiUrl),
  };
}
