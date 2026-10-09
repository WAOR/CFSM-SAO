import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Server,
  Sliders,
  RotateCcw,
  ArrowLeft,
  CircleDollarSign,
  Compass,
  ClipboardCheck,
  ClipboardCopy,
  Cloud,
  CloudAlert,
  CloudDownload,
  CloudOff,
  ChevronDown,
  ChevronUp,
  Grid3x3,
  LayoutGrid,
  LayoutTemplate,
  Layers,
  List,
  ListFilter,
  Moon,
  Rows3,
  Search,
  Sparkles,
  Square,
  Sun,
  SunMoon,
} from "lucide-react";
import { clsx } from "clsx";
import { InstancePanel } from "@/components/instance/InstancePanel";
import { Spinner } from "@/components/ui/Spinner";
import { Flag } from "@/components/ui/Flag";
import { MatrixPatternEditor } from "@/components/matrix/MatrixPatternEditor";
import { LatencyBars } from "@/components/node/LatencyBars";
import { QualityBars } from "@/components/node/QualityBars";
import { useCarrierNames, usePublicConfig } from "@/hooks/usePublicConfig";
import { useHourlyClock } from "@/hooks/useClock";
import { useAllPingLineOverrides } from "@/hooks/usePingOverview";
import {
  cancelSiteThemeSync,
  hasUnsyncedLocalChanges,
  useCanSyncSiteTheme,
  useSiteThemeOptions,
  useSiteThemeSyncStatus,
  type SiteThemeSyncPhase,
} from "@/hooks/useSiteThemeOptions";
import { useLocalThemeSettings } from "@/hooks/useThemeSettings";
import { getNodes } from "@/services/api";
import { carrierPingTasks } from "@/services/cfsm/mappers";
import { clearPingLineOverrides } from "@/services/pingLineOverrideStore";
import {
  getLocalThemeSettings,
  resetLocalThemeSettings,
  saveLocalThemeSettings,
} from "@/services/themeSettingsStore";
import { copyText } from "@/utils/clipboard";
import type {
  MatrixColorTheme,
  MatrixBootEffect,
  NodeInfo,
  PingTask,
  ThemeSettings,
  PingLatencyColors,
  PingLatencyThresholds,
  PingLossColors,
  PingLossThresholds,
  PingOverviewBucket,
  TrafficSpectrumColors,
} from "@/types/cfsm";
import {
  calculateCostSummary,
  calculateCostPremiumAmount,
  calculateCostPremiumBasisAt,
  formatCnyMoney,
  formatSignedCny,
  getExchangeRates,
  isCostRateApiUrlValid,
  normalizeCostIgnoredNodes,
  normalizeCostPremiums,
  normalizeCostRateApiUrl,
  type CostPremiumEntry,
} from "@/utils/cost";
import { normalizeNodeIdentityList } from "@/utils/nodeIdentity";
import {
  DEFAULT_PING_LATENCY_COLORS,
  DEFAULT_PING_LATENCY_THRESHOLDS,
  DEFAULT_PING_LOSS_COLORS,
  DEFAULT_PING_LOSS_THRESHOLDS,
  DEFAULT_TRAFFIC_SPECTRUM_COLORS,
  STATUS_BAR_PRESETS,
  type StatusBarPreset,
  normalizePingLatencyColors,
  normalizePingLatencyThresholds,
  normalizePingLossColors,
  normalizePingLossThresholds,
  normalizeTrafficSpectrumColors,
} from "@/utils/themeSettings";
import { buildTrafficQuotaSegmentColors } from "@/utils/metricTone";
import { MAX_RENEWAL_REMINDER_DAYS } from "@/utils/renewalReminder";
import {
  dedupeGroupLabels,
  normalizeHomeGroupOrder,
  sortHomeGroupOptions,
} from "@/utils/homeNodes";
import {
  HOMEPAGE_MULTI_PING_MAX_COUNT,
  HOMEPAGE_MULTI_PING_MIN_COUNT,
  assignHomepageMultiPingTask,
  isHomepageMultiPingConfigured,
  normalizeHomepageMultiPingTaskIds,
  normalizeHomepagePingTaskBindings,
  type HomepagePingTaskBindings,
} from "@/utils/pingTasks";
import {
  DEFAULT_THEME_SETTINGS,
  normalizeThemeSettings,
  withPreferredAppearance,
  type ResolvedThemeSettings,
} from "@/utils/themeSettings";

import {
  type OverviewRatingKind,
  getDefaultOverviewRatingLabelText,
} from "@/utils/overviewRating";
import { HOME_SORT_FIELDS, HOME_SORT_FIELD_LABELS } from "@/utils/homeSort";

const OVERVIEW_RATING_LABEL_FIELDS: Array<{
  key: Extract<OverviewRatingKind, "bandwidth" | "asset">;
  title: string;
  scopeBadge: string;
  description: string;
  toggleKey: "showBandwidthRating" | "showAssetRating";
  tierHint: string;
  isBadge?: boolean;
}> = [
  {
    key: "bandwidth",
    title: "实时带宽",
    scopeBadge: "展台顶部",
    description: "显示在「集群展台」标题旁，实时反馈总吞吐负荷。",
    toggleKey: "showBandwidthRating",
    tierHint: "对应阶梯：≤1Mbps、≤10Mbps、≤100Mbps、>100Mbps",
    isBadge: true,
  },
  {
    key: "asset",
    title: "资产规模",
    scopeBadge: "卡片底部",
    description: "显示在「资产总值」卡片右下角，按总资产规模定级。",
    toggleKey: "showAssetRating",
    tierHint: "对应阶梯：≤500元、≤1500元、≤3000元、>3000元",
  },
];


interface ColorThemeOption {
  id: MatrixColorTheme;
  label: string;
  badge: string;
  desc: string;
  colors: [string, string, string, string];
  badgeClass: string;
}

const COLOR_THEME_OPTIONS: ColorThemeOption[] = [
  {
    id: "default",
    label: "经典标准",
    badge: "CLASSIC",
    desc: "绿 · 橙 · 红 常规监控色阶",
    colors: ["#34d399", "#10b981", "#f59e0b", "#ef4444"],
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    id: "eva",
    label: "EVA 初号机",
    badge: "EVA UNIT-01",
    desc: "机体紫 · 荧光绿 · 警告橙 · 暴走红",
    colors: ["#7c3aed", "#00ff66", "#f97316", "#ef4444"],
    badgeClass: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  },
  {
    id: "cyberpunk",
    label: "夜之城 2077",
    badge: "NIGHT CITY",
    desc: "斯安威斯坦青 · 霓虹亮黄 · 超频绯红",
    colors: ["#00f0ff", "#fcee0a", "#ff0055", "#ef4444"],
    badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30",
  },
  {
    id: "divergence",
    label: "命运石之门",
    badge: "1.048596%",
    desc: "待机暖杏橙 · 氖气放电暖橙 · 烈焰超频红橙",
    colors: ["#fdba74", "#f97316", "#ea580c", "#ef4444"],
    badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30",
  },
];

interface BootEffectOption {
  id: MatrixBootEffect;
  label: string;
  badge: string;
  desc: string;
  badgeClass: string;
}

const BOOT_EFFECT_OPTIONS: BootEffectOption[] = [
  {
    id: "laser-scan",
    label: "激光横扫 (Laser Scan)",
    badge: "RADAR",
    desc: "经典雷达激光束自左向右横向扫描显影，纯正 SAO 机能风格",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    id: "digital-rain",
    label: "数码雨流 (Digital Rain)",
    badge: "CASCADE",
    desc: "交错流光瀑布自上而下倾泻显影，如黑客帝国代码雨般涌现",
    badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30",
  },
  {
    id: "cyber-glitch",
    label: "神经故障 (Cyber Glitch)",
    badge: "OVERCLOCK",
    desc: "斯安威斯坦电光青与超频品红噪波爆闪、行撕裂与协议校准咬合",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border-fuchsia-500/30",
  },
  {
    id: "divergence-flux",
    label: "世界线跳变 (Divergence Flux)",
    badge: "1.048596%",
    desc: "真空管惰性氖气放电赤橙火花高频跳动，自左向右逐位锁定定格",
    badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30",
  },
];

const APPEARANCE_OPTIONS = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "system", label: "跟随系统", icon: SunMoon },
  { value: "dark", label: "深色", icon: Moon },
] as const;

const NODE_VIEW_MODE_OPTIONS = [
  { value: "large", label: "大卡片", icon: Square },
  { value: "compact", label: "小卡片", icon: LayoutGrid },
  { value: "mini", label: "迷你卡片", icon: Grid3x3 },
  { value: "list", label: "列表", icon: List },
] as const;

const MOBILE_VIEW_MODE_OPTIONS = NODE_VIEW_MODE_OPTIONS.filter((option) => option.value !== "list");

function localDateInputMax() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function sortTasks(tasks: PingTask[]) {
  return [...tasks].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    if (left.id !== right.id) return left.id - right.id;
    return left.name.localeCompare(right.name);
  });
}

function buildPremiumEntry(
  amount: number,
  paidCny?: number,
  acquiredAt?: string,
): CostPremiumEntry {
  return {
    amount,
    ...(paidCny != null ? { paidCny } : {}),
    ...(acquiredAt ? { acquiredAt } : {}),
  };
}

function sortClients(clients: NodeInfo[]) {
  return [...clients].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    return left.name.localeCompare(right.name);
  });
}

function filterClients(clients: NodeInfo[], rawKeyword: string) {
  const keyword = rawKeyword.trim().toLowerCase();
  if (!keyword) return clients;
  return clients.filter((client) => {
    const group = String(client.group || "").toLowerCase();
    const region = String(client.region || "").toLowerCase();
    return (
      client.name.toLowerCase().includes(keyword) ||
      client.uuid.toLowerCase().includes(keyword) ||
      group.includes(keyword) ||
      region.includes(keyword)
    );
  });
}

function summarizeNodes(
  uuids: string[],
  clientsById: Map<string, NodeInfo>,
) {
  if (uuids.length === 0) return "点右侧「编辑节点」把节点加进来";
  const names = uuids.map((uuid) => clientsById.get(uuid)?.name || uuid);
  const summary = names.join("、");
  return summary.length > 92 ? `${summary.slice(0, 92)}...` : summary;
}

function pruneBindings(bindings: HomepagePingTaskBindings) {
  const normalized = normalizeHomepagePingTaskBindings(bindings);
  const pruned: HomepagePingTaskBindings = {};

  for (const [taskId, clients] of Object.entries(normalized)) {
    if (clients.length > 0) {
      pruned[taskId] = clients;
    }
  }

  return pruned;
}

function applyClientAssignment(
  bindings: HomepagePingTaskBindings,
  taskId: number,
  clientUuid: string,
  checked: boolean,
) {
  const taskKey = String(taskId);
  const next = pruneBindings(bindings);

  for (const [currentTaskId, clients] of Object.entries(next)) {
    const filtered = clients.filter((uuid) => uuid !== clientUuid);
    if (filtered.length > 0) {
      next[currentTaskId] = filtered;
    } else {
      delete next[currentTaskId];
    }
  }

  if (checked) {
    const selected = next[taskKey] ?? [];
    next[taskKey] = Array.from(new Set([...selected, clientUuid])).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  return next;
}

function invertBindings(bindings: HomepagePingTaskBindings): Map<string, string> {
  const assignedTaskByClient = new Map<string, string>();
  for (const [taskId, clients] of Object.entries(bindings)) {
    for (const clientUuid of clients) {
      assignedTaskByClient.set(clientUuid, taskId);
    }
  }
  return assignedTaskByClient;
}

function applyAvailableClientAssignments(
  bindings: HomepagePingTaskBindings,
  taskId: number,
  clientUuids: string[],
) {
  const taskKey = String(taskId);
  const next = pruneBindings(bindings);
  const assignedTaskByClient = invertBindings(next);
  const selected = new Set(next[taskKey] ?? []);

  for (const clientUuid of clientUuids) {
    const assignedTaskId = assignedTaskByClient.get(clientUuid);
    if (assignedTaskId && assignedTaskId !== taskKey) continue;
    selected.add(clientUuid);
  }

  if (selected.size > 0) {
    next[taskKey] = [...selected].sort((left, right) => left.localeCompare(right));
  } else {
    delete next[taskKey];
  }

  return next;
}

function pickManagedThemeSettings(settings: ResolvedThemeSettings) {
  return {
    defaultAppearance: settings.defaultAppearance,
    desktopNodeViewMode: settings.desktopNodeViewMode,
    mobileNodeViewMode: settings.mobileNodeViewMode,
    clusterOverviewMode: settings.clusterOverviewMode,
    matrixColorTheme: settings.matrixColorTheme,
    matrixMockFill: settings.matrixMockFill,
    matrixBootAnimation: settings.matrixBootAnimation,
    matrixBootEffect: settings.matrixBootEffect,
    matrixCustomPattern: settings.matrixCustomPattern,
    matrixUserPresets: settings.matrixUserPresets,
    homepagePingBindings: settings.homepagePingBindings,
    homepageDefaultPingTaskId: settings.homepageDefaultPingTaskId,
    enableHomepageMultiPing: settings.enableHomepageMultiPing,
    homepageMultiPingTaskIds: settings.homepageMultiPingTaskIds,
    fakePingForUnbound: settings.fakePingForUnbound,
    pingLatencyThresholds: normalizePingLatencyThresholds(settings.pingLatencyThresholds),
    pingLatencyColors: normalizePingLatencyColors(settings.pingLatencyColors),
    pingLossThresholds: normalizePingLossThresholds(settings.pingLossThresholds),
    pingLossColors: normalizePingLossColors(settings.pingLossColors),
    trafficSpectrumColors: normalizeTrafficSpectrumColors(settings.trafficSpectrumColors),
    showHomeOverview: settings.showHomeOverview,
    showAssetOverview: settings.showAssetOverview,
    showGroupTabs: settings.showGroupTabs,
    showRegionBar: settings.showRegionBar,
    showCardGroup: settings.showCardGroup,
    showCardPrice: settings.showCardPrice,
    homeGroupOrder: settings.homeGroupOrder,
    homeDefaultGroup: settings.homeDefaultGroup,
    enableHomeSort: settings.enableHomeSort,
    homeSortField: settings.homeSortField,
    homeSortDirection: settings.homeSortDirection,
    offlineNodesFirst: settings.offlineNodesFirst,
    adminNickname: settings.adminNickname,
    showCostSummary: settings.showCostSummary,
    showCostSummaryFloatingButton: settings.showCostSummaryFloatingButton,
    showPriceForGuests: settings.showPriceForGuests,
    renewalReminderDays: settings.renewalReminderDays,
    showOverviewRatings: settings.showOverviewRatings,
    showBandwidthRating: settings.showBandwidthRating,
    showAssetRating: settings.showAssetRating,
    bandwidthRatingLabels: settings.bandwidthRatingLabels,
    assetRatingLabels: settings.assetRatingLabels,
    compactShowTrafficTotal: settings.compactShowTrafficTotal,
    compactShowBilling: settings.compactShowBilling,
    compactShowUptime: settings.compactShowUptime,
    showConnections: settings.showConnections,
    hiddenNodes: settings.hiddenNodes,
    costIgnoredNodes: settings.costIgnoredNodes,
    costPremiums: Object.fromEntries(
      Object.keys(settings.costPremiums)
        .sort()
        .map((uuid) => [uuid, settings.costPremiums[uuid]]),
    ),
    costRateApiUrl: settings.costRateApiUrl,
  };
}

function managedSettingsSignature(settings: ThemeSettings & Record<string, unknown>) {
  return JSON.stringify(pickManagedThemeSettings(normalizeThemeSettings(settings)));
}

type ManagedThemeSettings = ReturnType<typeof pickManagedThemeSettings>;

type ThemeDraft = Omit<
  ManagedThemeSettings,
  | "hiddenNodes"
  | "costIgnoredNodes"
  | "bandwidthRatingLabels"
  | "assetRatingLabels"
> & {
  ratingLabels: {
    bandwidth: string;
    asset: string;
  };
  hiddenNodesText: string;
  costIgnoredText: string;
};

function draftFromSettings(settings: ResolvedThemeSettings): ThemeDraft {
  const {
    hiddenNodes,
    costIgnoredNodes,
    bandwidthRatingLabels,
    assetRatingLabels,
    ...rest
  } = pickManagedThemeSettings(settings);
  return {
    ...rest,
    ratingLabels: {
      bandwidth: bandwidthRatingLabels,
      asset: assetRatingLabels,
    },
    hiddenNodesText: hiddenNodes.join("\n"),
    costIgnoredText: costIgnoredNodes.join("\n"),
  };
}

type BooleanDraftKey = {
  [K in keyof ThemeDraft]: ThemeDraft[K] extends boolean ? K : never;
}[keyof ThemeDraft];

const ToggleRow = memo(function ToggleRow({
  field,
  title,
  desc,
  checked,
  onPatch,
}: {
  field: BooleanDraftKey;
  title: string;
  desc: string;
  checked: boolean;
  onPatch: (key: BooleanDraftKey, value: boolean) => void;
}) {
  return (
    <label className="surface-inset flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block setting-subhead-title">{title}</span>
        <span className="mt-1 block setting-hint">{desc}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onPatch(field, event.target.checked)}
        className="h-4 w-4 shrink-0 accent-(--accent-500)"
      />
    </label>
  );
});

function SettingSelect({
  wrapperClassName,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={clsx("setting-select", wrapperClassName)}>
      <select
        {...props}
        className={clsx(
          "surface-inset text-[13px] text-(--text-primary) outline-none",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown size={14} className="setting-select-icon" aria-hidden />
    </div>
  );
}

const EMPTY_ASSIGNED_CLIENTS: string[] = [];
const EMPTY_ADMIN_CLIENTS: NodeInfo[] = [];

const TaskBindingSection = memo(function TaskBindingSection({
  task,
  defaultTaskId,
  assigned,
  expanded,
  clientsById,
  visibleClients,
  assignedTaskByClientUuid,
  nodeSearch,
  onNodeSearch,
  onToggleExpand,
  onPatchBindings,
}: {
  task: PingTask;
  defaultTaskId: number;
  assigned: string[];
  expanded: boolean;
  clientsById: Map<string, NodeInfo>;
  visibleClients: NodeInfo[];
  assignedTaskByClientUuid: Map<string, string>;
  nodeSearch: string;
  onNodeSearch: (value: string) => void;
  onToggleExpand: (taskId: number) => void;
  onPatchBindings: (
    updater: (prev: HomepagePingTaskBindings) => HomepagePingTaskBindings,
  ) => void;
}) {
  const assignedSummary = summarizeNodes(assigned, clientsById);
  const isDefaultTask = task.id === defaultTaskId;
  const selectableVisibleClients = expanded
    ? visibleClients.filter((client) => {
        const assignedTaskId = assignedTaskByClientUuid.get(client.uuid);
        return !assignedTaskId || assignedTaskId === String(task.id);
      })
    : EMPTY_ADMIN_CLIENTS;
  const allVisibleSelectableAssigned =
    selectableVisibleClients.length > 0 &&
    selectableVisibleClients.every((client) => assigned.includes(client.uuid));
  return (
    <section className="surface-inset px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-(--text-primary)">
              {task.name || `任务 #${task.id}`}
            </h3>
            {isDefaultTask && (
              <span className="rounded-full border border-(--hairline) px-2 py-0.5 text-[10px] font-medium text-(--text-tertiary)">
                默认线路
              </span>
            )}
          </div>
          <div className="mt-2 text-[12px] text-(--text-secondary)">
            <span className="font-medium text-(--text-primary)">
              {assigned.length > 0
                ? `${assigned.length} 台节点在首页显示这条线路的延迟`
                : "还没有节点选这条线路"}
            </span>
            {isDefaultTask && (
              <>
                <span className="mx-2 text-(--text-tertiary)">·</span>
                <span>没单独指定线路的节点都走这条</span>
              </>
            )}
          </div>
          <p className="mt-2 text-[12px] text-(--text-tertiary)" title={assignedSummary}>
            {assignedSummary}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {expanded && (
            <button
              type="button"
              disabled={selectableVisibleClients.length === 0 || allVisibleSelectableAssigned}
              onClick={() => {
                onPatchBindings((prev) =>
                  applyAvailableClientAssignments(
                    prev,
                    task.id,
                    selectableVisibleClients.map((client) => client.uuid),
                  ),
                );
              }}
              className="theme-manage-button is-compact"
            >
              {allVisibleSelectableAssigned ? "已全选可用" : "全选可用"}
            </button>
          )}
          {assigned.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onPatchBindings((prev) => {
                  const next = { ...prev };
                  delete next[String(task.id)];
                  return pruneBindings(next);
                });
              }}
              className="theme-manage-button is-compact is-danger"
            >
              清空节点
            </button>
          )}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggleExpand(task.id)}
            className="theme-manage-button is-compact"
          >
            {expanded ? "收起节点" : "编辑节点"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-(--hairline) pt-4">
          <label className="surface-inset flex items-center gap-2 px-3 py-2">
            <Search size={14} className="text-(--text-tertiary)" />
            <input
              value={nodeSearch}
              onChange={(event) => onNodeSearch(event.target.value)}
              placeholder="搜索节点名称 / UUID / 分组 / 地区"
              aria-label="搜索节点"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-(--text-tertiary)"
            />
          </label>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleClients.map((client) => {
              const checked = assigned.includes(client.uuid);
              const subtitle = [client.group, client.uuid].filter(Boolean).join(" · ");
              return (
                <label
                  key={client.uuid}
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
                    checked
                      ? "border-(--border-strong) bg-[color-mix(in_srgb,var(--hover-bg)_72%,transparent)]"
                      : "border-(--hairline) bg-transparent hover:bg-(--hover-bg)",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const nextChecked = event.target.checked;
                      onPatchBindings((prev) =>
                        applyClientAssignment(prev, task.id, client.uuid, nextChecked),
                      );
                    }}
                    className="mt-1 h-4 w-4 shrink-0 accent-(--accent-500)"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Flag region={client.region} size={14} />
                      <span className="truncate setting-subhead-title">
                        {client.name}
                      </span>
                    </div>
                    <div className="mt-1 setting-hint">
                      {subtitle || client.region || "未设置分组"}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
});

type PremiumDetail = ReturnType<typeof calculateCostSummary>["details"][number];

const PremiumList = memo(function PremiumList({
  clients,
  costPremiums,
  detailByUuid,
  rateLoading,
  acquiredAtMax,
  onPatchPaid,
  onPatchAcquiredAt,
}: {
  clients: NodeInfo[];
  costPremiums: ThemeDraft["costPremiums"];
  detailByUuid: Map<string, PremiumDetail>;
  rateLoading: boolean;
  acquiredAtMax: string;
  onPatchPaid: (uuid: string, rawValue: string) => void;
  onPatchAcquiredAt: (uuid: string, rawValue: string) => void;
}) {
  return (
    <div className="surface-inset max-h-80 overflow-y-auto">
      {clients.map((client) => {
        const entry = costPremiums[client.uuid];
        const detail = detailByUuid.get(client.uuid);
        const referenceLabel = rateLoading
          ? "计算中"
          : detail
            ? detail.counted
              ? formatCnyMoney(detail.remainingCny)
              : detail.note || "--"
            : "--";
        const canCompute = detail != null && (detail.counted || detail.note === "免费");
        return (
          <div
            key={client.uuid}
            className="flex flex-col gap-2 border-b border-(--hairline) px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Flag region={client.region ?? ""} size={13} />
              <span
                className="truncate text-[13px] font-medium text-(--text-primary)"
                title={client.name}
              >
                {client.name}
              </span>
              <span
                className="shrink-0 setting-hint"
                title="该节点当前剩余价值（按账单周期折算，不含溢价）"
              >
                {referenceLabel}
              </span>
              {entry && (
                <span
                  className="shrink-0 text-[11px] font-medium"
                  style={{
                    color:
                      entry.amount > 0
                        ? "var(--status-error)"
                        : entry.amount < 0
                          ? "var(--status-success)"
                          : "var(--text-tertiary)",
                  }}
                  title={
                    entry.paidCny != null
                      ? "溢价 = 收购价 − 收购日剩余价值；该折算基准已经固化"
                      : "旧格式：直接记录的溢价，填写收购价后自动升级"
                  }
                >
                  溢价 {formatSignedCny(entry.amount)}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={entry?.paidCny ?? ""}
                onChange={(event) => {
                  if (event.target.validity.badInput) return;
                  onPatchPaid(client.uuid, event.target.value);
                }}
                placeholder="收购价"
                disabled={!canCompute}
                aria-label={`${client.name} 的收购价`}
                title={
                  canCompute
                    ? "实际收购价（人民币），留空即清除记录"
                    : "该节点已忽略或汇率缺失，无法折算剩余价值"
                }
                className="surface-inset w-24 px-2 py-1 text-right text-[13px] outline-none disabled:opacity-45 max-sm:flex-1"
              />
              <input
                type="date"
                max={acquiredAtMax}
                value={entry?.acquiredAt ?? ""}
                onChange={(event) => onPatchAcquiredAt(client.uuid, event.target.value)}
                disabled={!entry || !canCompute}
                aria-label={`${client.name} 的收购日期`}
                title={
                  canCompute
                    ? "收购日期：修改后会按当前价格、周期、到期日和汇率回算该日剩余价值，重新计算并固化溢价"
                    : "该节点已忽略或汇率缺失，无法折算剩余价值"
                }
                className="surface-inset w-35 px-2 py-1 text-[12px] outline-none disabled:opacity-45 max-sm:flex-1"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

type ThemeTabId = "home" | "card" | "cost";


interface LatencyTierConfig {
  key: keyof PingLatencyColors;
  label: string;
  hint: string;
  defaultColor: string;
}

const LATENCY_TIER_CONFIG: readonly LatencyTierConfig[] = [
  { key: "excellent" as const, label: "极佳 (<=)", hint: "最优网络，极低延迟", defaultColor: DEFAULT_PING_LATENCY_COLORS.excellent },
  { key: "good" as const, label: "良好 (<=)", hint: "畅快体验，稳定流畅", defaultColor: DEFAULT_PING_LATENCY_COLORS.good },
  { key: "moderate" as const, label: "轻度 (<=)", hint: "轻度感知，正常可接受", defaultColor: DEFAULT_PING_LATENCY_COLORS.moderate },
  { key: "elevated" as const, label: "偏高 (<=)", hint: "较高延迟，可明显感知", defaultColor: DEFAULT_PING_LATENCY_COLORS.elevated },
  { key: "critical" as const, label: "极高", hint: "严重延迟，极度拥堵或告警", defaultColor: DEFAULT_PING_LATENCY_COLORS.critical },
] as const;

const LOSS_TIER_CONFIG = [
  { key: "zero" as const, label: "无丢包 (0%)", hint: "网络通畅，零样本丢失", defaultColor: DEFAULT_PING_LOSS_COLORS.zero },
  { key: "low" as const, label: "轻微丢包", hint: "偶发微量丢包，基本可用", defaultColor: DEFAULT_PING_LOSS_COLORS.low },
  { key: "medium" as const, label: "中度丢包", hint: "较明显持续丢包，需注意", defaultColor: DEFAULT_PING_LOSS_COLORS.medium },
  { key: "high" as const, label: "严重丢包", hint: "严重丢包甚至失联脱网", defaultColor: DEFAULT_PING_LOSS_COLORS.high },
] as const;

const TRAFFIC_SPECTRUM_ANCHOR_CONFIG = [
  {
    key: "start" as const,
    label: "充裕健康色 (0% ~ 15%)",
    stage: "充裕健康期",
    hint: "初始充裕配额，健康充足状态",
    defaultColor: DEFAULT_TRAFFIC_SPECTRUM_COLORS.start,
  },
  {
    key: "mid" as const,
    label: "半程消耗色 (~50%)",
    stage: "半程稳定期",
    hint: "中期消耗过半，进入稳定过渡期",
    defaultColor: DEFAULT_TRAFFIC_SPECTRUM_COLORS.mid,
  },
  {
    key: "high" as const,
    label: "警戒消耗色 (~80%)",
    stage: "警戒告警期",
    hint: "额度告急进入警戒红热期",
    defaultColor: DEFAULT_TRAFFIC_SPECTRUM_COLORS.high,
  },
  {
    key: "end" as const,
    label: "耗尽告警色 (100%)",
    stage: "耗尽守护",
    hint: "严格锁止最终暴走赤红守护",
    defaultColor: DEFAULT_TRAFFIC_SPECTRUM_COLORS.end,
  },
] as const;

const PREVIEW_LATENCY_BUCKETS: PingOverviewBucket[] = [
  18, 36, 55, 72, 88, 105, 120, 138, 155, 168, 185, 198, 215, 245, 280, 320,
].map((v, i) => ({
  index: i,
  value: v,
  loss: 0,
  total: 60,
  lost: 0,
  startAt: null,
  endAt: null,
  offline: false,
}));

const PREVIEW_LOSS_BUCKETS: PingOverviewBucket[] = [
  0, 0, 0, 0, 1.5, 2.8, 4.5, 6.2, 8.5, 12.0, 16.5, 22.0, 35.0, 55.0, 78.0, 100.0,
].map((loss, i) => ({
  index: i,
  value: 30,
  loss,
  total: 60,
  lost: Math.round((loss / 100) * 60),
  startAt: null,
  endAt: null,
  offline: false,
}));

const THEME_TABS: ReadonlyArray<{
  id: ThemeTabId;
  label: string;
  hint: string;
  icon: typeof ListFilter;
}> = [
  { id: "home", label: "首页", hint: "外观、展台、权限与评级", icon: ListFilter },
  { id: "card", label: "服务器", hint: "视图、指标、排序与延迟", icon: Server },
  { id: "cost", label: "资产", hint: "费用统计与二手溢价", icon: CircleDollarSign },
];

const DEFAULT_THEME_TAB: ThemeTabId = "home";

function isThemeTabId(value: string | null): value is ThemeTabId {
  return value != null && THEME_TABS.some((tab) => tab.id === value);
}

const THEME_AUTO_SAVE_DEBOUNCE_MS = 600;
const BODY_BOTTOM_GAP = 2;
const MIN_BODY_HEIGHT = 320;

function SiteSyncIndicator({
  phase,
  invalid,
  waiting,
  toSite,
  savedLocally,
}: {
  phase: SiteThemeSyncPhase;
  invalid: boolean;
  waiting: boolean;
  toSite: boolean;
  savedLocally: boolean;
}) {
  const [icon, text] = invalid
    ? [
        <CloudOff key="off" size={14} />,
        toSite ? "有设置填得不对，暂未同步" : "有设置填得不对，暂未保存",
      ]
    : !toSite
      ? [
          <Sparkles key="local" size={14} />,
          savedLocally ? "已保存到本机" : "改动会自动保存到本机",
        ]
      : phase === "saving" || phase === "pending" || waiting
        ? [<Cloud key="syncing" size={14} className="is-spinning" />, "正在同步到后端…"]
        : phase === "synced"
          ? [<Cloud key="synced" size={14} />, "已同步到后端"]
          : phase === "error"
            ? [<CloudAlert key="error" size={14} />, "同步失败，正在重试…"]
            : [<Cloud key="idle" size={14} />, "改动会自动同步到后端"];

  return (
    <span
      className={clsx(
        "theme-manage-sync-status",
        invalid || phase === "error" ? "is-error" : undefined,
      )}
    >
      {icon}
      <span>{text}</span>
    </span>
  );
}

export function ThemeManage() {
  const now = useHourlyClock();
  const {
    data: config,
    isLoading: configLoading,
    error: configError,
    refetch: refetchConfig,
  } = usePublicConfig();
  const carrierNames = useCarrierNames();
  const [draft, setDraft] = useState<ThemeDraft>(() =>
    draftFromSettings(DEFAULT_THEME_SETTINGS),
  );
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const normalizedTab = tabParam === "ping" ? "card" : tabParam;
  const activeTab: ThemeTabId = isThemeTabId(normalizedTab) ? normalizedTab : DEFAULT_THEME_TAB;
  const [nodeSearch, setNodeSearch] = useState("");
  const [premiumSearch, setPremiumSearch] = useState("");
  const [savedLocally, setSavedLocally] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 右上角悬浮气泡 Toast（fixed 脱离文档流，0 挤动页面布局，3 秒自动淡出）
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  const canSaveToSite = useCanSyncSiteTheme();
  const siteSync = useSiteThemeSyncStatus();
  const editVersionRef = useRef(0);

  const patch = useCallback(
    <K extends keyof ThemeDraft>(key: K, value: ThemeDraft[K]) => {
      editVersionRef.current += 1;
      setDraft((prev) => (Object.is(prev[key], value) ? prev : { ...prev, [key]: value }));
    },
    [],
  );

  const patchBindings = useCallback(
    (updater: (prev: HomepagePingTaskBindings) => HomepagePingTaskBindings) => {
      editVersionRef.current += 1;
      setDraft((prev) => ({
        ...prev,
        homepagePingBindings: updater(prev.homepagePingBindings),
      }));
    },
    [],
  );

  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    const measure = () => {
      if (window.innerWidth < 900) {
        element.style.removeProperty("--theme-body-height");
        return;
      }
      const rect = element.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const main = element.closest("main");
      let padBottom = 0;
      for (
        let node: HTMLElement | null = element.parentElement;
        node && main && (node === main || main.contains(node));
        node = node.parentElement
      ) {
        const style = window.getComputedStyle(node);
        padBottom +=
          parseFloat(style.paddingBottom || "0") + parseFloat(style.borderBottomWidth || "0");
        if (node === main) break;
      }
      const footerHeight =
        document.querySelector(".site-footer")?.getBoundingClientRect().height ?? 0;
      const available = window.innerHeight - top - footerHeight - padBottom - BODY_BOTTOM_GAP;
      element.style.setProperty("--theme-body-height", `${Math.max(MIN_BODY_HEIGHT, available)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    const topbar = document.querySelector(".theme-topbar");
    const footer = document.querySelector(".site-footer");
    if (topbar) observer.observe(topbar);
    if (footer) observer.observe(footer);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, []);

  const openTab = useCallback(
    (next: ThemeTabId) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("tab", next);
          return params;
        },
        { replace: true },
      );
      if (window.innerWidth >= 900) {
        sectionsRef.current?.scrollTo({ top: 0 });
      } else {
        bodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [setSearchParams],
  );

  const toggleTaskExpanded = useCallback((taskId: number) => {
    setExpandedTaskId((current) => (current === taskId ? null : taskId));
    setNodeSearch("");
  }, []);


  const patchPingLatencyThreshold = useCallback(
    (key: keyof PingLatencyThresholds, val: number) => {
      editVersionRef.current += 1;
      setDraft((prev) => ({
        ...prev,
        pingLatencyThresholds: {
          ...prev.pingLatencyThresholds,
          [key]: val,
        },
      }));
    },
    [],
  );

  const patchPingLatencyColor = useCallback(
    (key: keyof PingLatencyColors, val: string) => {
      editVersionRef.current += 1;
      setDraft((prev) => ({
        ...prev,
        pingLatencyColors: {
          ...prev.pingLatencyColors,
          [key]: val,
        },
      }));
    },
    [],
  );

  const resetPingLatency = useCallback(() => {
      editVersionRef.current += 1;
    setDraft((prev) => ({
      ...prev,
      pingLatencyThresholds: { ...DEFAULT_PING_LATENCY_THRESHOLDS },
      pingLatencyColors: { ...DEFAULT_PING_LATENCY_COLORS },
    }));
  }, []);

  const patchPingLossThreshold = useCallback(
    (key: keyof PingLossThresholds, val: number) => {
      editVersionRef.current += 1;
      setDraft((prev) => ({
        ...prev,
        pingLossThresholds: {
          ...prev.pingLossThresholds,
          [key]: val,
        },
      }));
    },
    [],
  );

  const patchPingLossColor = useCallback(
    (key: keyof PingLossColors, val: string) => {
      editVersionRef.current += 1;
      setDraft((prev) => ({
        ...prev,
        pingLossColors: {
          ...prev.pingLossColors,
          [key]: val,
        },
      }));
    },
    [],
  );

  const resetPingLoss = useCallback(() => {
      editVersionRef.current += 1;
    setDraft((prev) => ({
      ...prev,
      pingLossThresholds: { ...DEFAULT_PING_LOSS_THRESHOLDS },
      pingLossColors: { ...DEFAULT_PING_LOSS_COLORS },
    }));
  }, []);

  const patchTrafficSpectrumColor = useCallback(
    (key: keyof TrafficSpectrumColors, val: string) => {
      editVersionRef.current += 1;
      setDraft((prev) => ({
        ...prev,
        trafficSpectrumColors: {
          ...prev.trafficSpectrumColors,
          [key]: val,
        },
      }));
    },
    [],
  );

  const applyStatusBarPreset = useCallback((preset: StatusBarPreset) => {
    editVersionRef.current += 1;
    setDraft((prev) => ({
      ...prev,
      trafficSpectrumColors: { ...preset.colors },
      pingLatencyColors: { ...preset.latencyColors },
      pingLossColors: { ...preset.lossColors },
    }));
  }, []);

  const resetTrafficSpectrum = useCallback(() => {
      editVersionRef.current += 1;
    setDraft((prev) => ({
      ...prev,
      trafficSpectrumColors: { ...DEFAULT_TRAFFIC_SPECTRUM_COLORS },
    }));
  }, []);

  const previewTrafficSegmentColors = useMemo(
    () => buildTrafficQuotaSegmentColors(draft.trafficSpectrumColors),
    [draft.trafficSpectrumColors],
  );

  const commitMultiPingTaskIds = useCallback(
    (mutate: (prev: number[]) => number[]) => {
      editVersionRef.current += 1;
      setDraft((prev) => {
        const homepageMultiPingTaskIds = normalizeHomepageMultiPingTaskIds(
          mutate([...prev.homepageMultiPingTaskIds]),
        );
        return JSON.stringify(homepageMultiPingTaskIds) ===
          JSON.stringify(prev.homepageMultiPingTaskIds)
          ? prev
          : { ...prev, homepageMultiPingTaskIds };
      });
    },
    [],
  );

  const patchMultiPingTask = useCallback(
    (slot: number, rawValue: string) => {
      commitMultiPingTaskIds((ids) => {
        if (rawValue === "") {
          ids.splice(slot, 1);
          return ids;
        }
        return assignHomepageMultiPingTask(ids, slot, Number(rawValue));
      });
    },
    [commitMultiPingTaskIds],
  );

  const removeMultiPingTask = useCallback(
    (slot: number) => {
      commitMultiPingTaskIds((ids) => {
        ids.splice(slot, 1);
        return ids;
      });
    },
    [commitMultiPingTaskIds],
  );

  const addMultiPingTask = useCallback(() => {
    commitMultiPingTaskIds((ids) => {
      const nextTask = sortedTasksRef.current.find((task) => !ids.includes(task.id));
      if (nextTask) ids.push(nextTask.id);
      return ids;
    });
  }, [commitMultiPingTaskIds]);

  const pingTasks = useMemo(() => carrierPingTasks(carrierNames), [carrierNames]);

  const {
    data: adminClients,
    error: clientsError,
  } = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: ({ signal }) => getNodes({ signal }),
    staleTime: 30_000,
    retry: false,
  });

  const sourceThemeSettings = useMemo(
    () => normalizeThemeSettings(config?.theme_settings),
    [config?.theme_settings],
  );
  const sourceSignature = useMemo(
    () => JSON.stringify(pickManagedThemeSettings(sourceThemeSettings)),
    [sourceThemeSettings],
  );
  const lastSeededSignatureRef = useRef<string | null>(null);

  const seedDrafts = useCallback((next: ResolvedThemeSettings) => {
    setDraft(draftFromSettings(next));
  }, []);

  const sortedTasks = useMemo(() => sortTasks(pingTasks ?? []), [pingTasks]);
  const sortedTasksRef = useRef(sortedTasks);
  sortedTasksRef.current = sortedTasks;

  const multiPingSlotLimit = Math.min(
    HOMEPAGE_MULTI_PING_MAX_COUNT,
    Math.max(sortedTasks.length, HOMEPAGE_MULTI_PING_MIN_COUNT),
  );
  const sortedClients = useMemo(() => sortClients(adminClients ?? []), [adminClients]);
  const clientsById = useMemo(
    () => new Map(sortedClients.map((client) => [client.uuid, client])),
    [sortedClients],
  );

  const availableGroups = useMemo(
    () => dedupeGroupLabels(sortedClients.map((client) => client.group)),
    [sortedClients],
  );
  const orderedDraftGroups = useMemo(
    () => sortHomeGroupOptions(availableGroups, draft.homeGroupOrder),
    [availableGroups, draft.homeGroupOrder],
  );
  const moveGroup = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedDraftGroups.length) return;
    const next = [...orderedDraftGroups];
    [next[index], next[target]] = [next[target], next[index]];
    patch("homeGroupOrder", next);
  };

  const visibleClients = useMemo(
    () => filterClients(sortedClients, nodeSearch),
    [nodeSearch, sortedClients],
  );
  const filteredPremiumClients = useMemo(
    () => filterClients(sortedClients, premiumSearch),
    [premiumSearch, sortedClients],
  );

  const allMeta = sortedClients;
  const premiumRateQuery = useQuery({
    queryKey: ["cost-rates", sourceThemeSettings.costRateApiUrl],
    queryFn: ({ signal }) => getExchangeRates(sourceThemeSettings.costRateApiUrl, { signal }),
    staleTime: 60 * 60 * 1000,
    enabled: allMeta.length > 0,
    retry: 1,
  });
  const premiumDetailByUuid = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateCostSummary>["details"][number]>();
    if (!premiumRateQuery.data) return map;
    const summary = calculateCostSummary(
      allMeta,
      sourceThemeSettings.costIgnoredNodes,
      premiumRateQuery.data.rates,
      undefined,
      now,
    );
    for (const detail of summary.details) map.set(detail.uuid, detail);
    return map;
  }, [allMeta, now, sourceThemeSettings.costIgnoredNodes, premiumRateQuery.data]);

  const premiumBasisAt = useCallback(
    (uuid: string, acquiredAt?: string): number | null => {
      if (!premiumRateQuery.data) return null;
      if (!acquiredAt || acquiredAt === localDateInputMax()) {
        const detail = premiumDetailByUuid.get(uuid);
        if (!detail) return null;
        if (detail.note === "免费") return 0;
        return detail.counted ? detail.remainingCny : null;
      }
      return calculateCostPremiumBasisAt(
        allMeta,
        sourceThemeSettings.costIgnoredNodes,
        premiumRateQuery.data.rates,
        uuid,
        acquiredAt,
        now,
      );
    },
    [
      allMeta,
      now,
      premiumDetailByUuid,
      sourceThemeSettings.costIgnoredNodes,
      premiumRateQuery.data,
    ],
  );

  const premiumConfiguredCount = useMemo(
    () => Object.keys(draft.costPremiums).length,
    [draft.costPremiums],
  );

  const patchPremiumPaid = useCallback(
    (uuid: string, rawValue: string) => {
      editVersionRef.current += 1;
      setDraft((prev) => {
        const next = { ...prev.costPremiums };
        if (rawValue.trim() === "") {
          if (!(uuid in next)) return prev;
          delete next[uuid];
          return { ...prev, costPremiums: next };
        }
        const paid = Number(rawValue);
        if (!Number.isFinite(paid) || paid < 0) return prev;
        const current = prev.costPremiums[uuid];
        if (current && Object.is(current.paidCny, paid)) return prev;
        const acquiredAt = current?.acquiredAt ?? localDateInputMax();
        const storedBasis =
          current?.paidCny != null ? current.paidCny - current.amount : Number.NaN;
        const basis = Number.isFinite(storedBasis)
          ? storedBasis
          : premiumBasisAt(uuid, acquiredAt);
        if (basis == null) return prev;
        next[uuid] = buildPremiumEntry(
          calculateCostPremiumAmount(paid, basis, current),
          paid,
          acquiredAt,
        );
        return { ...prev, costPremiums: next };
      });
    },
    [premiumBasisAt],
  );

  const patchPremiumAcquiredAt = useCallback(
    (uuid: string, rawValue: string) => {
      editVersionRef.current += 1;
      setDraft((prev) => {
        const current = prev.costPremiums[uuid];
        if (!current) return prev;
        const acquiredAt = rawValue.trim() || undefined;
        if (current.acquiredAt === acquiredAt) return prev;
        let amount = current.amount;
        if (acquiredAt && current.paidCny != null) {
          const basis = premiumBasisAt(uuid, acquiredAt);
          if (basis == null) return prev;
          amount = calculateCostPremiumAmount(current.paidCny, basis);
        }
        const next = { ...prev.costPremiums };
        next[uuid] = buildPremiumEntry(amount, current.paidCny, acquiredAt);
        return { ...prev, costPremiums: next };
      });
    },
    [premiumBasisAt],
  );

  const draftHiddenNodes = useMemo(
    () => normalizeNodeIdentityList(draft.hiddenNodesText),
    [draft.hiddenNodesText],
  );
  const draftCostRateApiUrlInvalid =
    draft.costRateApiUrl.trim() !== "" && !isCostRateApiUrlValid(draft.costRateApiUrl.trim());
  const draftMultiPingInvalid =
    draft.enableHomepageMultiPing &&
    !isHomepageMultiPingConfigured(draft.homepageMultiPingTaskIds);

  const setRatingLabelDraft = useCallback((key: "bandwidth" | "asset", value: string) => {
    editVersionRef.current += 1;
    setDraft((prev) => ({
      ...prev,
      ratingLabels: {
        ...prev.ratingLabels,
        [key]: value,
      },
    }));
  }, []);

  const draftThemeSettings = useMemo<ThemeSettings>(() => {
    const { ratingLabels, hiddenNodesText, costIgnoredText, ...rest } = draft;
    return {
      ...rest,
      homepagePingBindings: pruneBindings(rest.homepagePingBindings),
      homeGroupOrder: normalizeHomeGroupOrder(rest.homeGroupOrder),
      bandwidthRatingLabels: ratingLabels.bandwidth,
      assetRatingLabels: ratingLabels.asset,
      hiddenNodes: normalizeNodeIdentityList(hiddenNodesText),
      costIgnoredNodes: normalizeCostIgnoredNodes(costIgnoredText),
      costPremiums: normalizeCostPremiums(rest.costPremiums),
      costRateApiUrl: normalizeCostRateApiUrl(rest.costRateApiUrl),
    };
  }, [draft]);

  const draftSignature = useMemo(
    () => managedSettingsSignature(draftThemeSettings as ThemeSettings & Record<string, unknown>),
    [draftThemeSettings],
  );
  const costRateApiUrlDirty =
    draft.costRateApiUrl.trim() !== sourceThemeSettings.costRateApiUrl;
  const isDirty = draftSignature !== sourceSignature || costRateApiUrlDirty;

  useEffect(() => {
    if (isDirty) setMessage(null);
  }, [isDirty]);

  useEffect(() => {
    if (!config) return;
    if (lastSeededSignatureRef.current === sourceSignature) return;
    if (lastSeededSignatureRef.current !== null && isDirty) return;
    lastSeededSignatureRef.current = sourceSignature;
    seedDrafts(sourceThemeSettings);
  }, [config, isDirty, sourceSignature, sourceThemeSettings, seedDrafts]);

  const assignedNodeCount = useMemo(
    () =>
      Object.values(draft.homepagePingBindings).reduce(
        (total, clients) => total + clients.length,
        0,
      ),
    [draft.homepagePingBindings],
  );

  const assignedTaskByClientUuid = useMemo(
    () => invertBindings(draft.homepagePingBindings),
    [draft.homepagePingBindings],
  );

  const localThemeSettings = useLocalThemeSettings();
  const allLineOverrides = useAllPingLineOverrides();
  const localLineOverrideCount = Object.keys(allLineOverrides).length;

  const autoSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    autoSaveRef.current = null;
    if (!config || editVersionRef.current === 0) return;
    if (draftSignature === sourceSignature) return;
    if (draftCostRateApiUrlInvalid || draftMultiPingInvalid) return;
    const save = () => {
      autoSaveRef.current = null;
      lastSeededSignatureRef.current = draftSignature;
      saveLocalThemeSettings({ ...getLocalThemeSettings(), ...draftThemeSettings });
      setSavedLocally(true);
    };
    autoSaveRef.current = save;
    const timer = window.setTimeout(save, THEME_AUTO_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    config,
    draftCostRateApiUrlInvalid,
    draftMultiPingInvalid,
    draftSignature,
    draftThemeSettings,
    sourceSignature,
  ]);
  useEffect(() => () => autoSaveRef.current?.(), []);

  const { snapshot: siteDefaults } = useSiteThemeOptions(draftThemeSettings);

  const siteDefaultsJson = useMemo(
    () => JSON.stringify(siteDefaults, null, 2),
    [siteDefaults],
  );

  const handleCopySiteDefaults = async () => {
    setError(null);
    if (await copyText(siteDefaultsJson)) {
      setCopied(true);
      setMessage("配置 JSON 已复制，粘贴到后台「外观设置 → 主题自定义配置」保存即可成为所有设备的默认值");
      window.setTimeout(() => setCopied(false), 2000);
      return;
    }
    setMessage(null);
    setError("复制失败，请检查浏览器的剪贴板权限");
  };

  const handleRestoreSiteDefaults = () => {
    cancelSiteThemeSync();
    resetLocalThemeSettings();
    clearPingLineOverrides();
    seedDrafts(
      normalizeThemeSettings(
        withPreferredAppearance(config?.preferredAppearance, config?.theme_settings ?? {}),
      ),
    );
    setMessage("已丢弃本机设置，改用后端当前的配置");
    setError(null);
  };

  const draftAwaitingAutoSave = draftSignature !== sourceSignature;
  const siteHasUnsyncedChanges = hasUnsyncedLocalChanges({
    hasLocalChanges: Object.keys(localThemeSettings).length > 0 || localLineOverrideCount > 0,
    phase: siteSync.phase,
    waiting: draftAwaitingAutoSave,
  });

  if (configLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div role="alert" className="space-y-2">
          <div className="text-[15px] font-semibold text-(--text-primary)">
            无法读取主题配置
          </div>
          <p className="max-w-lg text-[13px] text-(--text-secondary)">
            {configError instanceof Error ? configError.message : "请稍后重试。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void refetchConfig()}
            className="theme-manage-button px-4 py-2 text-[13px] font-medium"
          >
            重试
          </button>
          <Link to="/" className="theme-manage-button px-4 py-2 text-[13px] font-medium">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const adminError = clientsError instanceof Error ? clientsError.message : null;
  const acquiredAtMax = localDateInputMax();

  return (
    <div className="theme-manage flex flex-col gap-5 py-2">
      {/* 右上角悬浮气泡 Toast（fixed 绝对定位，绝不挤压页面任何布局，3秒自动淡出） */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-9999 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500/35 bg-(--bg-card)/95 backdrop-blur-md text-xs font-semibold text-emerald-600 dark:text-emerald-400 pointer-events-auto"
        >
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-1 text-(--text-muted) hover:text-(--text-primary) transition-colors text-xs leading-none"
            title="关闭通知"
          >
            ✕
          </button>
        </div>
      )}

      <header className="theme-topbar">
        <Link to="/" className="instance-page-back theme-topbar-back">
          <ArrowLeft size={14} />
          <span>返回首页</span>
        </Link>
        <h1 className="theme-topbar-title">主题设置</h1>
        <div className="theme-manage-toolbar-actions">
          {(!canSaveToSite || siteHasUnsyncedChanges) && (
            <button
              type="button"
              onClick={handleRestoreSiteDefaults}
              className="theme-manage-button"
              title={
                canSaveToSite
                  ? "放弃这台设备上还没同步到后端的改动，改用后端当前的配置"
                  : "放弃本机存过的设置，改用后端当前的配置"
              }
            >
              <CloudDownload size={14} />
              <span>改用后端配置</span>
            </button>
          )}
          {!canSaveToSite && (
            <button
              type="button"
              onClick={() => void handleCopySiteDefaults()}
              className="theme-manage-button"
              title="复制当前设置的 JSON；粘贴到后台「外观设置 → 主题自定义配置」即可让所有设备用同一套配置"
            >
              {copied ? <ClipboardCheck size={14} /> : <ClipboardCopy size={14} />}
              <span>{copied ? "已复制" : "复制配置 JSON"}</span>
            </button>
          )}
          <SiteSyncIndicator
            phase={siteSync.phase}
            invalid={isDirty && (draftCostRateApiUrlInvalid || draftMultiPingInvalid)}
            waiting={draftAwaitingAutoSave}
            toSite={canSaveToSite}
            savedLocally={savedLocally}
          />
        </div>
      </header>

      {(message || error || adminError) && (
        <div className="flex flex-col gap-3">
          {message && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-[color-mix(in_srgb,var(--status-online)_28%,transparent)] bg-[color-mix(in_srgb,var(--status-online)_11%,var(--surface))] px-4 py-3 text-[13px] text-(--status-online)"
            >
              {message}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[color-mix(in_srgb,var(--status-offline)_28%,transparent)] bg-[color-mix(in_srgb,var(--status-offline)_11%,var(--surface))] px-4 py-3 text-[13px] text-(--status-offline)"
            >
              {error}
            </div>
          )}
          {adminError && (
            <div
              role="alert"
              className="rounded-xl border border-[color-mix(in_srgb,var(--status-offline)_28%,transparent)] bg-[color-mix(in_srgb,var(--status-offline)_11%,var(--surface))] px-4 py-3 text-[13px] text-(--status-offline)"
            >
              无法读取后台节点列表: {adminError}
            </div>
          )}
        </div>
      )}

      <div className="theme-manage-body" ref={bodyRef}>
        <nav className="theme-tab-rail" aria-label="设置分组">
          {THEME_TABS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => openTab(id)}
              data-active={activeTab === id ? "true" : "false"}
              aria-current={activeTab === id ? "page" : undefined}
              className="theme-tab"
            >
              <Icon size={14} className="theme-tab-icon" />
              <span className="theme-tab-label">{label}</span>
              <span className="theme-tab-hint">{hint}</span>
            </button>
          ))}
        </nav>

        <div className="theme-manage-sections" ref={sectionsRef}>
          {activeTab === "home" && (
            <>
              <InstancePanel
                id="set-appearance"
                kicker="外观"
                title="显示外观"
                aside={<LayoutTemplate size={16} />}
              >
                <div className="instance-segmented is-prominent is-even">
                  {APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      data-active={draft.defaultAppearance === value ? "true" : "false"}
                      aria-pressed={draft.defaultAppearance === value}
                      onClick={() => patch("defaultAppearance", value)}
                      className="inline-flex items-center justify-center gap-2"
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </InstancePanel>

              <InstancePanel
                kicker="总览"
                title="监控总览"
                aside={<Layers size={16} />}
              >
                <ToggleRow
                  field="showHomeOverview"
                  title="监控总览"
                  desc="在首页顶部展示监控总览模块。"
                  checked={draft.showHomeOverview}
                  onPatch={patch}
                />
              </InstancePanel>

              <InstancePanel
                kicker="权限"
                title="访客权限"
                aside={<Compass size={16} />}
              >
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="setting-subhead-title block mb-2">卡片操作入口</span>
                    <div className="grid gap-3 md:grid-cols-2">
                      <ToggleRow
                        field="showCostSummary"
                        title="资产入口"
                        desc="在资产卡片显示进入按钮；未公开时仅管理员可见。"
                        checked={draft.showCostSummary}
                        onPatch={patch}
                      />
                      <ToggleRow
                        field="showCostSummaryFloatingButton"
                        title="悬浮入口"
                        desc="在右下角悬浮显示资产入口，未显示卡片时生效。"
                        checked={draft.showCostSummaryFloatingButton}
                        onPatch={patch}
                      />
                    </div>
                  </div>

                  <div className="border-t border-(--border-subtle) pt-3">
                    <span className="setting-subhead-title block mb-2">访客公开与可见性权限</span>
                    <div className="grid gap-3">
                      <ToggleRow
                        field="showPriceForGuests"
                        title="公开资产"
                        desc="允许访客查看机器价格与资产总额，关闭则保密。"
                        checked={draft.showPriceForGuests}
                        onPatch={patch}
                      />
                    </div>
                  </div>
                </div>
              </InstancePanel>

              

              {draft.clusterOverviewMode === "nodes" && (
                <InstancePanel
                  id="set-matrix-settings"
                  kicker="矩阵"
                  title="矩阵定制"
                  aside={<LayoutGrid size={16} />}
                >
                  {/* 1. 矩阵配色风格切换 */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-(--text-primary) flex items-center gap-1.5">
                          <span>配色风格</span>
                          {(() => {
                            const currentOpt = COLOR_THEME_OPTIONS.find(
                              (opt) => opt.id === (draft.matrixColorTheme ?? "default"),
                            ) ?? COLOR_THEME_OPTIONS[0];
                            return (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${currentOpt.badgeClass}`}
                              >
                                {currentOpt.badge}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-[11px] text-(--text-muted) mt-0.5">
                          定制方格矩阵与指标卡片的高光配色风格。
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {COLOR_THEME_OPTIONS.map((opt) => {
                        const isSelected = (draft.matrixColorTheme ?? "default") === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => patch("matrixColorTheme", opt.id)}
                            data-active={isSelected ? "true" : "false"}
                            aria-pressed={isSelected}
                            className={`setting-color-theme-card ${opt.id === "eva" ? "is-eva" : ""}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex items-center gap-1 shrink-0 p-1 rounded-md bg-(--bg-card) border border-(--hairline)">
                                {opt.colors.map((c, i) => (
                                  <span
                                    key={i}
                                    className="w-2.5 h-2.5 rounded-xs"
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-(--text-primary) block truncate">
                                  {opt.label}
                                </span>
                                <span className="text-[10px] text-(--text-muted) block truncate">
                                  {opt.desc}
                                </span>
                              </div>
                            </div>
                            <div className="setting-color-theme-radio" aria-hidden="true">
                              {isSelected && (
                                <div className="setting-color-theme-radio-dot" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. SAO 主题开场动画 */}
                  <div className="mt-4 pt-3.5 border-t border-(--hairline)">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-(--text-primary) flex items-center gap-1.5">
                          <span>开屏动画</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                            BOOT INTRO
                          </span>
                        </div>
                        <p className="text-[11px] text-(--text-muted) mt-0.5">
                          进入首页时播放光效开屏动画，随后载入数据。
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.matrixBootAnimation ?? true}
                        onChange={(event) => patch("matrixBootAnimation", event.target.checked)}
                        className="h-4 w-4 shrink-0 accent-(--accent-500)"
                      />
                    </label>

                    {/* 开场点阵图案自定义画布（仅在开启开场动画时展开） */}
                    {(draft.matrixBootAnimation ?? true) && (
                      <div className="mt-3.5 space-y-4">
                        {/* 动效形式独立选择器 */}
                        <div className="rounded-xl border border-(--hairline) bg-[color-mix(in_srgb,var(--bg-card)_55%,transparent)] p-3 sm:p-3.5">
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div>
                              <div className="text-xs font-semibold text-(--text-primary) flex items-center gap-1.5">
                                <span>动效样式</span>
                                {(() => {
                                  const currentEffect =
                                    BOOT_EFFECT_OPTIONS.find(
                                      (e) => e.id === (draft.matrixBootEffect ?? "laser-scan"),
                                    ) ?? BOOT_EFFECT_OPTIONS[0];
                                  return (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${currentEffect.badgeClass}`}
                                    >
                                      {currentEffect.badge}
                                    </span>
                                  );
                                })()}
                              </div>
                              <p className="text-[11px] text-(--text-muted) mt-0.5">
                                选择开屏画面的入场动效样式。
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {BOOT_EFFECT_OPTIONS.map((opt) => {
                              const isSelected = (draft.matrixBootEffect ?? "laser-scan") === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => patch("matrixBootEffect", opt.id)}
                                  data-active={isSelected ? "true" : "false"}
                                  aria-pressed={isSelected}
                                  className="setting-color-theme-card"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium text-(--text-primary) truncate">
                                          {opt.label}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-(--text-muted) block truncate mt-0.5">
                                        {opt.desc}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="setting-color-theme-radio" aria-hidden="true">
                                    {isSelected && (
                                      <div className="setting-color-theme-radio-dot" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 点阵画板 */}
                        <MatrixPatternEditor
                        value={draft.matrixCustomPattern}
                        userPresets={draft.matrixUserPresets}
                        colorTheme={draft.matrixColorTheme ?? "default"}
                        bootEffect={draft.matrixBootEffect ?? "laser-scan"}
                        onApply={(pattern) => {
                          patch("matrixCustomPattern", pattern);
                          showToast("已将点阵图案应用到首页并同步云端");
                        }}
                        onSaveUserPresets={(presets) => {
                          patch("matrixUserPresets", presets);
                          showToast("用户预设已更新并同步云端");
                        }}
                      />
                    </div>
                  )}
                  </div>

                  {/* 3. 模拟数据填充空闲机位插槽 */}
                  <div className="mt-4 pt-3.5 border-t border-(--hairline)">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-(--text-primary) flex items-center gap-1.5">
                          <span>模拟数据填充空闲机位插槽</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                            MOCK FILL
                          </span>
                        </div>
                        <p className="text-[11px] text-(--text-muted) mt-0.5">
                          开启后，机架方格矩阵中未接入服务器的闲置插槽将使用模拟数据填满，并在运行期间周期性随机变幻「空闲待机」、「活跃传输」与「高吞吐」状态及吞吐速率，令机架方格更显生机灵动。
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.matrixMockFill ?? false}
                        onChange={(event) => patch("matrixMockFill", event.target.checked)}
                        className="h-4 w-4 shrink-0 accent-(--accent-500)"
                      />
                    </label>
                  </div>
                </InstancePanel>
              )}

              <InstancePanel
                id="set-overview-ratings"
                kicker="评级"
                title="状态评级"
                aside={<ListFilter size={16} />}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {OVERVIEW_RATING_LABEL_FIELDS.map((field) => {
                    const defaultLabel = getDefaultOverviewRatingLabelText(field.key);
                    const ratingEnabled = draft[field.toggleKey];
                    return (
                      <div
                        key={field.key}
                        className={`surface-inset flex min-w-0 flex-col gap-2.5 px-4 py-3 transition-colors ${
                          field.isBadge ? "border-l-2 border-l-(--accent-500)" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="setting-subhead-title">{field.title}</span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                  field.isBadge
                                    ? "bg-(--accent-500)/15 text-(--accent-400) border border-(--accent-500)/30"
                                    : "bg-white/5 text-(--text-muted) border border-white/10"
                                }`}
                              >
                                {field.isBadge && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />}
                                {field.scopeBadge}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-(--text-tertiary) leading-normal">
                              {field.description}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={draft[field.toggleKey]}
                            onChange={(event) => patch(field.toggleKey, event.target.checked)}
                            className="h-4 w-4 shrink-0 mt-0.5 accent-(--accent-500)"
                            title={`开启/关闭${field.title}`}
                          />
                        </div>

                        <div className="flex flex-col gap-1.5 mt-auto pt-1">
                          <div className="flex items-center justify-between text-[11px] text-(--text-muted)">
                            <span>自定义分级词</span>
                            {!ratingEnabled && <span className="opacity-70">(已停用)</span>}
                          </div>
                          <input
                            value={draft.ratingLabels[field.key]}
                            disabled={!ratingEnabled}
                            onChange={(event) => setRatingLabelDraft(field.key, event.target.value)}
                            placeholder={defaultLabel}
                            aria-label={`${field.title}评级名称`}
                            className="surface-inset w-full px-3 py-1.5 text-[12px] outline-none disabled:opacity-60 font-mono"
                          />
                          <span className="setting-hint">
                            {field.tierHint}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </InstancePanel>
            </>
          )}

          {activeTab === "card" && (
            <>
              {/* 面板 1: 默认视图 */}
              <InstancePanel
                id="set-view"
                kicker="视图"
                title="默认视图"
                aside={<LayoutGrid size={16} />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="surface-inset setting-segment-slot flex flex-col gap-3 px-4 py-4">
                    <div>
                      <div className="setting-subhead-title">
                        桌面端
                      </div>
                      <div className="mt-1 setting-hint">
                        适用于宽度大于 720px 的浏览器窗口。
                      </div>
                    </div>
                    <div className="instance-segmented is-prominent is-even">
                      {NODE_VIEW_MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          data-active={draft.desktopNodeViewMode === value ? "true" : "false"}
                          aria-pressed={draft.desktopNodeViewMode === value}
                          onClick={() => patch("desktopNodeViewMode", value)}
                          className="inline-flex items-center justify-center gap-2"
                        >
                          <Icon size={14} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="surface-inset setting-segment-slot flex flex-col gap-3 px-4 py-4">
                    <div>
                      <div className="setting-subhead-title">
                        移动端
                      </div>
                      <div className="mt-1 setting-hint">
                        适用于宽度小于等于 720px 的手机或窄屏窗口。
                      </div>
                    </div>
                    <div className="instance-segmented is-prominent is-even">
                      {MOBILE_VIEW_MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          data-active={draft.mobileNodeViewMode === value ? "true" : "false"}
                          aria-pressed={draft.mobileNodeViewMode === value}
                          onClick={() => patch("mobileNodeViewMode", value)}
                          className="inline-flex items-center justify-center gap-2"
                        >
                          <Icon size={14} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </InstancePanel>

              {/* 面板 2: 卡片指标 */}
              <InstancePanel
              id="set-card-content"
              kicker="指标"
              title="卡片指标"
              description="自选各视图卡片上呈现的具体参数与开关。"
              aside={<Rows3 size={16} />}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  field="showGroupTabs"
                  title="分组标签"
                  desc="在服务器列表上方显示分组切换标签。"
                  checked={draft.showGroupTabs}
                  onPatch={patch}
                />
                <ToggleRow
                  field="showRegionBar"
                  title="地区标签"
                  desc="在服务器列表上方显示国旗地区筛选。"
                  checked={draft.showRegionBar}
                  onPatch={patch}
                />
                <ToggleRow
                  field="showCardGroup"
                  title="分组名称"
                  desc="在服务器卡片副标题标注所属分组。"
                  checked={draft.showCardGroup}
                  onPatch={patch}
                />
                <ToggleRow
                  field="showCardPrice"
                  title="价格到期"
                  desc="在卡片中显示续费周期、费用和到期日。"
                  checked={draft.showCardPrice}
                  onPatch={patch}
                />
                <ToggleRow
                  field="compactShowTrafficTotal"
                  title="累计流量"
                  desc="在紧凑卡片中展示月度或累计总流量。"
                  checked={draft.compactShowTrafficTotal}
                  onPatch={patch}
                />
                <ToggleRow
                  field="compactShowBilling"
                  title="计费周期"
                  desc="在紧凑卡片中标注续费计费周期。"
                  checked={draft.compactShowBilling}
                  onPatch={patch}
                />
                <ToggleRow
                  field="compactShowUptime"
                  title="在线时长"
                  desc="在紧凑卡片中展示系统持续运行时间。"
                  checked={draft.compactShowUptime}
                  onPatch={patch}
                />
                <ToggleRow
                  field="showConnections"
                  title="连接数量"
                  desc="在卡片网络区域标注实时网络连接数。"
                  checked={draft.showConnections}
                  onPatch={patch}
                />
              </div>
            </InstancePanel>

              {/* 面板 3: 列表排序 */}
              <InstancePanel
                id="set-home-sort"
                kicker="排序"
                title="列表排序"
                aside={<Rows3 size={16} />}
              >
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow
                      field="enableHomeSort"
                      title="允许访客切换排序"
                      desc="在首页提供排序下拉切换功能。"
                      checked={draft.enableHomeSort}
                      onPatch={patch}
                    />
                    <ToggleRow
                      field="offlineNodesFirst"
                      title="离线节点优先置顶"
                      desc="开启后失联服务器将排在最上方方便巡检，默认关闭（置底）。"
                      checked={draft.offlineNodesFirst}
                      onPatch={patch}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                      <span className="setting-subhead-title">默认指标</span>
                      <SettingSelect
                        value={draft.homeSortField}
                        onChange={(event) =>
                          patch(
                            "homeSortField",
                            event.target.value as (typeof HOME_SORT_FIELDS)[number],
                          )
                        }
                      >
                        {HOME_SORT_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {HOME_SORT_FIELD_LABELS[field]}
                          </option>
                        ))}
                      </SettingSelect>
                    </div>

                    <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                      <span className="setting-subhead-title">默认次序</span>
                      <SettingSelect
                        value={draft.homeSortDirection}
                        onChange={(event) =>
                          patch("homeSortDirection", event.target.value as "asc" | "desc")
                        }
                      >
                        <option value="asc">升序</option>
                        <option value="desc">降序</option>
                      </SettingSelect>
                    </div>
                  </div>

                  {availableGroups.length > 0 && (
                    <div className="surface-inset flex flex-col gap-3 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="setting-subhead-title">分组次序</span>
                        <span className="setting-hint">点击上下箭头调整次序</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {orderedDraftGroups.map((group, index) => (
                          <div
                            key={group}
                            className="flex items-center justify-between rounded-lg border border-(--hairline) px-3 py-2 text-[13px]"
                          >
                            <span>{group}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveGroup(index, -1)}
                                className="theme-manage-button is-compact"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={index === orderedDraftGroups.length - 1}
                                onClick={() => moveGroup(index, 1)}
                                className="theme-manage-button is-compact"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </InstancePanel>

              {/* 面板 4: 网络延迟 */}
              <InstancePanel
                id="set-ping-mode"
                kicker="延迟"
                title="网络延迟"
                description="设定延迟展示方式并为服务器指定线路。"
                aside={<Activity size={16} />}
              >
                <div className="flex flex-col gap-4">
                  <div className="surface-inset flex flex-col gap-3 px-4 py-4">
                    <span className="setting-subhead-title">展示模式</span>
                    <div className="instance-segmented is-prominent is-even is-stack-mobile">
                      <button
                        type="button"
                        data-active={!draft.enableHomepageMultiPing ? "true" : "false"}
                        onClick={() => patch("enableHomepageMultiPing", false)}
                      >
                        单线模式
                      </button>
                      <button
                        type="button"
                        data-active={draft.enableHomepageMultiPing ? "true" : "false"}
                        onClick={() => patch("enableHomepageMultiPing", true)}
                      >
                        多线模式
                      </button>
                    </div>
                  </div>

                  {draft.enableHomepageMultiPing ? (
                    <div className="surface-inset flex flex-col gap-3 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="setting-subhead-title">多线槽位</span>
                          <p className="setting-hint mt-1">
                            卡片将依序展示各线路的实时延迟光柱。
                          </p>
                        </div>
                        {draft.homepageMultiPingTaskIds.length < multiPingSlotLimit && (
                          <button
                            type="button"
                            onClick={addMultiPingTask}
                            className="theme-manage-button is-compact"
                          >
                            + 添加展示线路
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {draft.homepageMultiPingTaskIds.map((taskId, slot) => (
                          <div
                            key={slot}
                            className="flex items-center justify-between gap-2 rounded-[10px] border border-(--hairline) px-3 py-2"
                          >
                            <span className="text-[12px] font-medium text-(--text-secondary)">
                              槽位 #{slot + 1}
                            </span>
                            <SettingSelect
                              value={String(taskId)}
                              onChange={(event) => patchMultiPingTask(slot, event.target.value)}
                              wrapperClassName="flex-1"
                            >
                              {sortedTasks.map((task) => (
                                <option key={task.id} value={task.id}>
                                  {task.name || `线路 #${task.id}`}
                                </option>
                              ))}
                            </SettingSelect>
                            {draft.homepageMultiPingTaskIds.length > HOMEPAGE_MULTI_PING_MIN_COUNT && (
                              <button
                                type="button"
                                onClick={() => removeMultiPingTask(slot)}
                                className="theme-manage-button is-compact is-danger"
                              >
                                删除
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                        <span className="setting-subhead-title">默认线路</span>
                        <SettingSelect
                          value={String(draft.homepageDefaultPingTaskId)}
                          onChange={(event) =>
                            patch("homepageDefaultPingTaskId", Number(event.target.value))
                          }
                        >
                          {sortedTasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.name || `线路 #${task.id}`}
                            </option>
                          ))}
                        </SettingSelect>
                        <span className="setting-hint">未单独指派线路的服务器均显示此线路数据。</span>
                      </div>

                      <ToggleRow
                        field="fakePingForUnbound"
                        title="平滑占位"
                        desc="无探测数据时显示平滑占位，保持视觉整齐。"
                        checked={draft.fakePingForUnbound}
                        onPatch={patch}
                      />

                      <div className="flex flex-col gap-3">
                        <span className="setting-subhead-title">
                          专属线路 (已设 {assignedNodeCount} 台)
                        </span>
                        {sortedTasks.map((task) => (
                          <TaskBindingSection
                            key={task.id}
                            task={task}
                            defaultTaskId={draft.homepageDefaultPingTaskId}
                            assigned={draft.homepagePingBindings[String(task.id)] ?? EMPTY_ASSIGNED_CLIENTS}
                            expanded={expandedTaskId === task.id}
                            clientsById={clientsById}
                            visibleClients={visibleClients}
                            assignedTaskByClientUuid={assignedTaskByClientUuid}
                            nodeSearch={nodeSearch}
                            onNodeSearch={setNodeSearch}
                            onToggleExpand={toggleTaskExpanded}
                            onPatchBindings={patchBindings}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </InstancePanel>
            {/* 面板 5: 状态光柱 */}
              {/* 面板 5: 状态光柱 */}
              <InstancePanel
                kicker="光柱"
                title="状态光柱"
                description="定制流量、延迟与丢包光柱的过渡色与判断门槛。"
                aside={<Sliders size={16} />}
              >
                <div className="flex flex-col gap-5">
                  {/* 顶置配套方案预设：一套方案联动覆盖流量、延迟、丢包三处光柱 */}
                  <div className="surface-inset flex flex-col gap-3.5 px-4 py-4">
                    <div>
                      <span className="setting-subhead-title">配套预设方案</span>
                      <p className="setting-hint mt-1">
                        一键联动设定流量、延迟与丢包光柱的成套视觉方案。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {STATUS_BAR_PRESETS.map((preset) => {
                        const isSelected =
                          draft.trafficSpectrumColors.start === preset.colors.start &&
                          draft.trafficSpectrumColors.mid === preset.colors.mid &&
                          draft.trafficSpectrumColors.high === preset.colors.high &&
                          draft.trafficSpectrumColors.end === preset.colors.end &&
                          draft.pingLatencyColors.excellent === preset.latencyColors.excellent &&
                          draft.pingLatencyColors.good === preset.latencyColors.good &&
                          draft.pingLatencyColors.moderate === preset.latencyColors.moderate &&
                          draft.pingLatencyColors.elevated === preset.latencyColors.elevated &&
                          draft.pingLatencyColors.critical === preset.latencyColors.critical &&
                          draft.pingLossColors.zero === preset.lossColors.zero &&
                          draft.pingLossColors.low === preset.lossColors.low &&
                          draft.pingLossColors.medium === preset.lossColors.medium &&
                          draft.pingLossColors.high === preset.lossColors.high;
                        const gradient = `linear-gradient(to right, ${preset.colors.start}, ${preset.colors.mid}, ${preset.colors.high}, ${preset.colors.end})`;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyStatusBarPreset(preset)}
                            data-active={isSelected ? "true" : "false"}
                            aria-pressed={isSelected}
                            className="setting-spectrum-preset-card"
                          >
                            <div className="flex items-center justify-between gap-1.5 w-full">
                              <span
                                className={clsx(
                                  "text-xs font-semibold truncate",
                                  isSelected
                                    ? "text-(--accent-500)"
                                    : "text-(--text-primary)",
                                )}
                              >
                                {preset.name}
                              </span>
                              <div className="setting-color-theme-radio" aria-hidden="true">
                                {isSelected && <div className="setting-color-theme-radio-dot" />}
                              </div>
                            </div>
                            <div
                              className="h-2 w-full rounded-full shadow-inner ring-1 ring-black/10 dark:ring-white/10"
                              style={{ background: gradient }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 1. 流量进度光柱色谱自定义 */}
                  <div className="surface-inset flex flex-col gap-3.5 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="setting-subhead-title">流量光柱</span>
                        <p className="setting-hint mt-1">
                          从用量充裕到即将耗尽，呈现平滑过渡色谱。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetTrafficSpectrum}
                        className="theme-manage-button is-compact shrink-0 flex items-center gap-1.5"
                        title="恢复为默认的监控绿色谱"
                      >
                        <RotateCcw size={13} />
                        重置色彩
                      </button>
                    </div>

                    {/* 就近实时预览：18 段发光光柱色谱全貌（置顶呈现） */}
                    <div className="flex flex-col gap-2.5 rounded-[10px] border border-(--hairline) bg-(--bg-card) p-3.5">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-(--text-secondary) flex items-center gap-1.5">
                          <Sparkles size={13} className="text-(--accent-500)" />
                          流量光柱实时效果 (18 段)
                        </span>
                        <span className="text-[11px] text-(--text-tertiary)">
                          所见即所得 · 0% 充裕至 100% 耗尽连续色谱
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 rounded-md bg-(--bg-primary) p-2.5 shadow-inner">
                        <div className="flex items-center justify-between text-[11px] text-(--text-tertiary) mb-1">
                          <span>18 段发光光柱色谱全貌：</span>
                          <span className="font-mono">从轻载平滑过渡至警戒红</span>
                        </div>
                        <div className="traffic-quota-track" aria-hidden>
                          {previewTrafficSegmentColors.map((color, i) => (
                            <span key={i} className="traffic-quota-segment" style={{ background: color }} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 4 锚点 HEX 输入网格 */}
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      {TRAFFIC_SPECTRUM_ANCHOR_CONFIG.map(({ key, label, stage, hint, defaultColor }) => {
                        const currentColor = draft.trafficSpectrumColors[key];
                        const isEnd = key === "end";
                        return (
                          <div
                            key={key}
                            className="flex flex-col justify-between gap-2.5 rounded-[10px] border border-(--hairline) bg-(--bg-card) p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-semibold text-(--text-primary)">
                                {label}
                              </span>
                              <span
                                className={clsx(
                                  "text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium",
                                  isEnd
                                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                    : "bg-(--bg-primary) text-(--text-tertiary) border-(--hairline)",
                                )}
                              >
                                {stage}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="relative flex items-center justify-center shrink-0 cursor-pointer">
                                <span
                                  className="inline-block h-7 w-7 rounded-full border-2 border-white/40 shadow-sm"
                                  style={{ backgroundColor: currentColor }}
                                />
                                <input
                                  type="color"
                                  value={currentColor}
                                  onChange={(e) => patchTrafficSpectrumColor(key, e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  title={`选取${label}`}
                                />
                              </label>
                              <input
                                type="text"
                                maxLength={7}
                                value={currentColor}
                                onChange={(e) => patchTrafficSpectrumColor(key, e.target.value)}
                                className="surface-inset px-2.5 py-1 text-[12px] font-mono uppercase text-(--text-primary) w-full outline-none"
                                placeholder={defaultColor}
                              />
                            </div>

                            <p className="text-[11px] text-(--text-tertiary) leading-tight">
                              {hint}
                            </p>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-(--hairline)">
                              <span className="text-[11px] text-(--text-secondary) shrink-0">
                                {isEnd ? "末端特性" : "阶段定位"}
                              </span>
                              <span className="text-[11px] font-mono text-(--text-tertiary)">
                                {isEnd ? "严格警报红守护" : "平滑色谱锚点"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. 延迟评级标准与色彩设置 */}
                  <div className="surface-inset flex flex-col gap-3.5 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="setting-subhead-title">延迟光柱</span>
                        <p className="setting-hint mt-1">
                          设定各毫秒区间的判断门槛与对应光柱颜色。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetPingLatency}
                        className="theme-manage-button is-compact shrink-0 flex items-center gap-1.5"
                        title="恢复为默认的 60/100/160/200ms 及预设色"
                      >
                        <RotateCcw size={13} />
                        重置延迟
                      </button>
                    </div>

                    {/* 就近实时预览：延迟光柱 */}
                    <div className="flex flex-col gap-2 rounded-[10px] border border-(--hairline) bg-(--bg-card) p-3">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[12px]">
                        <span className="font-medium text-(--text-secondary) flex items-center gap-1.5">
                          <Activity size={13} className="text-(--status-success)" />
                          延迟光柱实时效果 (示例梯度 15ms ~ 320ms)
                        </span>
                        <span className="tabular font-medium text-(--text-tertiary) text-[11px]">
                          门槛：{draft.pingLatencyThresholds.excellent}ms / {draft.pingLatencyThresholds.good}ms / {draft.pingLatencyThresholds.moderate}ms / {draft.pingLatencyThresholds.elevated}ms
                        </span>
                      </div>
                      <div className="rounded-md bg-(--bg-primary) p-2 shadow-inner">
                        <LatencyBars
                          buckets={PREVIEW_LATENCY_BUCKETS}
                          latencyThresholds={draft.pingLatencyThresholds}
                          latencyColors={draft.pingLatencyColors}
                          height={18}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {LATENCY_TIER_CONFIG.map(({ key, label, hint, defaultColor }) => {
                        const currentColor = draft.pingLatencyColors[key];
                        const isThresholdEditable = key !== "critical";
                        const thresholdVal = isThresholdEditable
                          ? draft.pingLatencyThresholds[key]
                          : null;

                        return (
                          <div
                            key={key}
                            className="flex flex-col justify-between gap-2.5 rounded-[10px] border border-(--hairline) bg-(--bg-card) p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-semibold text-(--text-primary)">
                                {label}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <label
                                  className="metric-color-swatch"
                                  style={{ background: currentColor }}
                                  title="点击调整颜色"
                                >
                                  <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) => patchPingLatencyColor(key, e.target.value)}
                                  />
                                </label>
                                {currentColor.toLowerCase() !== defaultColor.toLowerCase() && (
                                  <button
                                    type="button"
                                    onClick={() => patchPingLatencyColor(key, defaultColor)}
                                    className="text-(--text-tertiary) hover:text-(--text-primary) transition-colors p-1"
                                    title="恢复该项默认色"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-[11px] text-(--text-tertiary) leading-tight">
                              {hint}
                            </p>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-(--hairline)">
                              <span className="text-[11px] text-(--text-secondary) shrink-0">
                                {isThresholdEditable ? "门槛上限" : "高延迟区间"}
                              </span>
                              {isThresholdEditable ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    max={9999}
                                    value={thresholdVal ?? 0}
                                    onChange={(e) => {
                                      const num = parseInt(e.target.value, 10);
                                      if (!Number.isNaN(num) && num > 0) {
                                        patchPingLatencyThreshold(key, num);
                                      }
                                    }}
                                    className="w-16 rounded-[5px] border border-(--hairline) bg-(--bg-primary) px-2 py-0.5 text-right font-mono text-[12px] font-medium outline-none focus:border-(--status-success)"
                                  />
                                  <span className="text-[11px] text-(--text-tertiary)">ms</span>
                                </div>
                              ) : (
                                <span className="font-mono text-[11px] text-(--text-tertiary)">
                                  &gt; {draft.pingLatencyThresholds.elevated}ms
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. 丢包评级标准与色彩设置 */}
                  <div className="surface-inset flex flex-col gap-3.5 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="setting-subhead-title">丢包光柱</span>
                        <p className="setting-hint mt-1">
                          设定不同丢包率区间的判断门槛与对应颜色。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetPingLoss}
                        className="theme-manage-button is-compact shrink-0 flex items-center gap-1.5"
                        title="恢复为默认的 3%/10% 门槛及预设色"
                      >
                        <RotateCcw size={13} />
                        重置丢包
                      </button>
                    </div>

                    {/* 就近实时预览：丢包光柱 */}
                    <div className="flex flex-col gap-2 rounded-[10px] border border-(--hairline) bg-(--bg-card) p-3">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[12px]">
                        <span className="font-medium text-(--text-secondary) flex items-center gap-1.5">
                          <Activity size={13} className="text-(--status-warning)" />
                          丢包光柱实时效果 (示例梯度 0% ~ 25%)
                        </span>
                        <span className="tabular font-medium text-(--text-tertiary) text-[11px]">
                          门槛：0% / {draft.pingLossThresholds.low}% / {draft.pingLossThresholds.medium}%
                        </span>
                      </div>
                      <div className="rounded-md bg-(--bg-primary) p-2 shadow-inner">
                        <QualityBars
                          buckets={PREVIEW_LOSS_BUCKETS}
                          lossThresholds={draft.pingLossThresholds}
                          lossColors={draft.pingLossColors}
                          height={18}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      {LOSS_TIER_CONFIG.map(({ key, label, hint, defaultColor }) => {
                        const currentColor = draft.pingLossColors[key];
                        const isEditable = key === "low" || key === "medium";
                        const thresholdVal =
                          key === "low"
                            ? draft.pingLossThresholds.low
                            : key === "medium"
                              ? draft.pingLossThresholds.medium
                              : null;

                        return (
                          <div
                            key={key}
                            className="flex flex-col justify-between gap-2.5 rounded-[10px] border border-(--hairline) bg-(--bg-card) p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-semibold text-(--text-primary)">
                                {label}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <label
                                  className="metric-color-swatch"
                                  style={{ background: currentColor }}
                                  title="点击调整颜色"
                                >
                                  <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) => patchPingLossColor(key, e.target.value)}
                                  />
                                </label>
                                {currentColor.toLowerCase() !== defaultColor.toLowerCase() && (
                                  <button
                                    type="button"
                                    onClick={() => patchPingLossColor(key, defaultColor)}
                                    className="text-(--text-tertiary) hover:text-(--text-primary) transition-colors p-1"
                                    title="恢复该项默认色"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-[11px] text-(--text-tertiary) leading-tight">
                              {hint}
                            </p>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-(--hairline)">
                              <span className="text-[11px] text-(--text-secondary) shrink-0">
                                {isEditable ? "丢包上限" : "生效条件"}
                              </span>
                              {isEditable ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.5"
                                    min={0.1}
                                    max={100}
                                    value={thresholdVal ?? 0}
                                    onChange={(e) => {
                                      const num = parseFloat(e.target.value);
                                      if (!Number.isNaN(num) && num > 0) {
                                        patchPingLossThreshold(key, num);
                                      }
                                    }}
                                    className="w-16 rounded-[5px] border border-(--hairline) bg-(--bg-primary) px-2 py-0.5 text-right font-mono text-[12px] font-medium outline-none focus:border-(--status-success)"
                                  />
                                  <span className="text-[11px] text-(--text-tertiary)">%</span>
                                </div>
                              ) : (
                                <span className="font-mono text-[11px] text-(--text-tertiary)">
                                  {key === "zero" ? "= 0% (完全健康)" : `> ${draft.pingLossThresholds.medium}%`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </InstancePanel>

              {/* 面板 6: 隐藏节点 */}
              <InstancePanel
                id="set-hidden-nodes"
                kicker="过滤"
                title="隐藏节点"
                aside={<Search size={16} />}
              >
                <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                  <span className="setting-subhead-title">隐藏名单 (每行一个 UUID 或名称)</span>
                  <textarea
                    rows={4}
                    value={draft.hiddenNodesText}
                    onChange={(event) => patch("hiddenNodesText", event.target.value)}
                    placeholder="node-uuid-1&#10;Tokyo Edge"
                    className="surface-inset p-3 text-[13px] font-mono outline-none"
                  />
                  <span className="setting-hint">
                    名单内的服务器不在首页呈现，已生效 {draftHiddenNodes.length} 台。
                  </span>
                </div>
              </InstancePanel>

              </>
          )}

          {activeTab === "cost" && (
            <>
              {/* 面板 1: 财务设置 */}
              <InstancePanel
                id="set-cost"
                kicker="资产"
                title="财务设置"
                description="管理汇率换算与不计费的排除服务器。"
                aside={<CircleDollarSign size={16} />}
              >
                <div className="flex flex-col gap-4">


                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="surface-inset flex flex-col gap-2 px-4 py-3">
                      <span className="setting-subhead-title">临期续费提醒天数</span>
                      <input
                        type="number"
                        min={0}
                        max={MAX_RENEWAL_REMINDER_DAYS}
                        value={draft.renewalReminderDays}
                        onChange={(event) => patch("renewalReminderDays", Number(event.target.value) || 0)}
                        className="surface-inset px-3 py-2 text-[13px] outline-none"
                      />
                      <span className="setting-hint">到期前多少天标黄预警，0 表示不提醒。</span>
                    </label>

                    <label className="surface-inset flex flex-col gap-2 px-4 py-3">
                      <span className="setting-subhead-title">汇率接口</span>
                      <input
                        type="url"
                        value={draft.costRateApiUrl}
                        onChange={(event) => patch("costRateApiUrl", event.target.value)}
                        placeholder="https://open.er-api.com/v6/latest/CNY"
                        className="surface-inset px-3 py-2 text-[13px] outline-none"
                      />
                      <span className="setting-hint">留空使用默认公共汇率接口。</span>
                    </label>
                  </div>

                  <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                    <span className="setting-subhead-title">排除机器</span>
                    <textarea
                      rows={3}
                      value={draft.costIgnoredText}
                      onChange={(event) => patch("costIgnoredText", event.target.value)}
                      placeholder="测试机&#10;node-uuid"
                      className="surface-inset p-3 text-[13px] font-mono outline-none"
                    />
                    <span className="setting-hint">填入的机器不计入资产总值与续费成本。</span>
                  </div>
                </div>
              </InstancePanel>

              {/* 面板 2: 买入溢价 */}
              <InstancePanel
                id="set-premiums"
                kicker="溢价"
                title="买入溢价"
                description="记录收机实际花费，系统自动平摊折溢价。"
                aside={<CircleDollarSign size={16} />}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <input
                      value={premiumSearch}
                      onChange={(event) => setPremiumSearch(event.target.value)}
                      placeholder="搜索服务器…"
                      className="surface-inset px-3 py-1.5 text-[13px] outline-none max-w-xs"
                    />
                    <span className="setting-hint">已记录 {premiumConfiguredCount} 台溢价</span>
                  </div>

                  <PremiumList
                    clients={filteredPremiumClients}
                    costPremiums={draft.costPremiums}
                    detailByUuid={premiumDetailByUuid}
                    rateLoading={premiumRateQuery.isLoading}
                    acquiredAtMax={acquiredAtMax}
                    onPatchPaid={patchPremiumPaid}
                    onPatchAcquiredAt={patchPremiumAcquiredAt}
                  />
                </div>
              </InstancePanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
