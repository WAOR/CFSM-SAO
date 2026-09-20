import type { ThemeSettings } from "@/types/cfsm";
import {
  DEFAULT_BACKGROUND_ALIGNMENT,
  DEFAULT_BACKGROUND_VIDEO_URL,
  DEFAULT_SURFACE_OPACITY,
  normalizeBackgroundAlignment,
  normalizeBackgroundUrl,
  normalizeBackgroundVideoUrl,
  normalizeSurfaceOpacity,
} from "@/utils/background";
import {
  DEFAULT_COST_RATE_API_URL,
  normalizeCostIgnoredNodes,
  normalizeCostPremiums,
  normalizeCostRateApiUrl,
  type CostPremiumEntry,
} from "@/utils/cost";
import { normalizeNodeIdentityList } from "@/utils/nodeIdentity";
import {
  DEFAULT_RENEWAL_REMINDER_DAYS,
  MAX_RENEWAL_REMINDER_DAYS,
} from "@/utils/renewalReminder";
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
export type BackgroundMediaType = "image" | "video";

export interface ResolvedThemeSettings {
  defaultAppearance: Appearance;
  desktopNodeViewMode: NodeViewMode;
  mobileNodeViewMode: NodeViewMode;
  enableAdminButton: boolean;
  showPingChart: boolean;
  homepagePingBindings: HomepagePingTaskBindings;
  homepageDefaultPingTaskId: number;
  enableHomepageMultiPing: boolean;
  homepageMultiPingTaskIds: number[];
  homepagePingLineOverrides: PingLineOverridesByNode;
  fakePingForUnbound: boolean;
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
  /** 还有几天到期开始提醒；0 = 不提醒。 */
  renewalReminderDays: number;
  showOverviewRatings: boolean;
  showAssetRating: boolean;
  assetRatingLabels: string;
  compactShowTrafficTotal: boolean;
  compactShowBilling: boolean;
  compactShowUptime: boolean;
  showConnections: boolean;
  hiddenNodes: string[];
  costIgnoredNodes: string[];
  costPremiums: Record<string, CostPremiumEntry>;
  costRateApiUrl: string;
  enableBackgroundImage: boolean;
  backgroundMediaType: BackgroundMediaType;
  backgroundImage: string;
  backgroundImageMobile: string;
  backgroundVideo: string;
  backgroundVideoDark: string;
  backgroundAlignment: string;
  surfaceOpacity: number;
}

export const DEFAULT_THEME_SETTINGS: ResolvedThemeSettings = {
  defaultAppearance: "system",
  desktopNodeViewMode: "large",
  mobileNodeViewMode: "compact",
  enableAdminButton: true,
  showPingChart: true,
  homepagePingBindings: {},
  homepageDefaultPingTaskId: DEFAULT_HOMEPAGE_PING_TASK_ID,
  enableHomepageMultiPing: true,
  homepageMultiPingTaskIds: [...DEFAULT_HOMEPAGE_MULTI_PING_TASK_IDS],
  homepagePingLineOverrides: EMPTY_PING_LINE_OVERRIDES_BY_NODE,
  fakePingForUnbound: false,
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
  renewalReminderDays: DEFAULT_RENEWAL_REMINDER_DAYS,
  showOverviewRatings: true,
  showAssetRating: true,
  assetRatingLabels: "",
  compactShowTrafficTotal: true,
  compactShowBilling: true,
  compactShowUptime: true,
  showConnections: false,
  hiddenNodes: [],
  costIgnoredNodes: [],
  costPremiums: {},
  costRateApiUrl: DEFAULT_COST_RATE_API_URL,
  enableBackgroundImage: true,
  backgroundMediaType: "image",
  backgroundImage: "",
  backgroundImageMobile: "",
  backgroundVideo: DEFAULT_BACKGROUND_VIDEO_URL,
  backgroundVideoDark: "",
  backgroundAlignment: DEFAULT_BACKGROUND_ALIGNMENT,
  surfaceOpacity: DEFAULT_SURFACE_OPACITY,
};

/** 首页默认分组：只收非空字符串，长度掐在合理范围内（分组名来自后端）。 */
function normalizeHomeDefaultGroup(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 120) : "";
}

/** 提醒天数：0~60 的整数，0 = 不提醒；写坏了回到默认。 */
function normalizeRenewalReminderDays(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RENEWAL_REMINDER_DAYS;
  return Math.min(MAX_RENEWAL_REMINDER_DAYS, Math.max(0, Math.round(parsed)));
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
    showCostSummary:
      enabledUnlessFalse(settings?.showCostSummary) ||
      settings?.showCostSummaryFloatingButton === true,
    showCostSummaryFloatingButton: settings?.showCostSummaryFloatingButton !== false,
    showPriceForGuests: settings?.showPriceForGuests === true,
    renewalReminderDays: normalizeRenewalReminderDays(settings?.renewalReminderDays),
    showOverviewRatings: enabledUnlessFalse(settings?.showOverviewRatings),
    showAssetRating: enabledUnlessFalse(settings?.showAssetRating),
    assetRatingLabels: normalizePlainText(settings?.assetRatingLabels),
    compactShowTrafficTotal: enabledUnlessFalse(settings?.compactShowTrafficTotal),
    compactShowBilling: enabledUnlessFalse(settings?.compactShowBilling),
    compactShowUptime: enabledUnlessFalse(settings?.compactShowUptime),
    showConnections: settings?.showConnections === true,
    hiddenNodes: normalizeNodeIdentityList(settings?.hiddenNodes),
    costIgnoredNodes: normalizeCostIgnoredNodes(settings?.costIgnoredNodes),
    costPremiums: normalizeCostPremiums(settings?.costPremiums),
    costRateApiUrl: normalizeCostRateApiUrl(settings?.costRateApiUrl),
    enableBackgroundImage: enabledUnlessFalse(settings?.enableBackgroundImage),
    backgroundMediaType: settings?.backgroundMediaType === "video" ? "video" : "image",
    backgroundImage: normalizeBackgroundUrl(settings?.backgroundImage),
    backgroundImageMobile: normalizeBackgroundUrl(settings?.backgroundImageMobile),
    backgroundVideo:
      normalizeBackgroundVideoUrl(settings?.backgroundVideo) || DEFAULT_BACKGROUND_VIDEO_URL,
    backgroundVideoDark: normalizeBackgroundVideoUrl(settings?.backgroundVideoDark),
    backgroundAlignment: normalizeBackgroundAlignment(settings?.backgroundAlignment),
    surfaceOpacity: normalizeSurfaceOpacity(settings?.surfaceOpacity),
  };
}
