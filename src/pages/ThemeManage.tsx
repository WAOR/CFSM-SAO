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
  ArrowLeft,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardCopy,
  Cloud,
  CloudAlert,
  CloudDownload,
  CloudOff,
  ChevronDown,
  ChevronUp,
  Grid3x3,
  ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  List,
  ListFilter,
  Moon,
  Rows3,
  Search,
  Sparkles,
  Square,
  Sun,
  SunMoon,
  Video,
  Wallpaper,
} from "lucide-react";
import { clsx } from "clsx";
import { InstancePanel } from "@/components/instance/InstancePanel";
import { Spinner } from "@/components/ui/Spinner";
import { Flag } from "@/components/ui/Flag";
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
import type { NodeInfo, PingTask, ThemeSettings } from "@/types/cfsm";
import {
  DEFAULT_BACKGROUND_VIDEO_URL,
  type BackgroundPosition,
  type BackgroundSize,
  normalizeBackgroundAlignment,
  parseBackgroundAlignment,
} from "@/utils/background";
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
  type BackgroundMediaType,
  type ResolvedThemeSettings,
} from "@/utils/themeSettings";

import { HOME_SORT_FIELDS, HOME_SORT_FIELD_LABELS } from "@/utils/homeSort";

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

const BACKGROUND_MEDIA_TYPE_OPTIONS: Array<{
  value: BackgroundMediaType;
  label: string;
  icon: typeof ImageIcon;
}> = [
  { value: "image", label: "图片", icon: ImageIcon },
  { value: "video", label: "视频", icon: Video },
];

const BACKGROUND_SIZE_OPTIONS: Array<{ value: BackgroundSize; label: string }> = [
  { value: "cover", label: "填满" },
  { value: "contain", label: "完整" },
  { value: "auto", label: "原始" },
];

const BACKGROUND_POSITION_OPTIONS: Array<{ value: BackgroundPosition; label: string }> = [
  { value: "top", label: "顶部" },
  { value: "center", label: "居中" },
  { value: "bottom", label: "底部" },
];

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
    homepagePingBindings: settings.homepagePingBindings,
    homepageDefaultPingTaskId: settings.homepageDefaultPingTaskId,
    enableHomepageMultiPing: settings.enableHomepageMultiPing,
    homepageMultiPingTaskIds: settings.homepageMultiPingTaskIds,
    fakePingForUnbound: settings.fakePingForUnbound,
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
    showAssetRating: settings.showAssetRating,
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
    enableBackgroundImage: settings.enableBackgroundImage,
    backgroundMediaType: settings.backgroundMediaType,
    backgroundImage: settings.backgroundImage,
    backgroundImageMobile: settings.backgroundImageMobile,
    backgroundVideo: settings.backgroundVideo,
    backgroundVideoDark: settings.backgroundVideoDark,
    backgroundAlignment: settings.backgroundAlignment,
    surfaceOpacity: settings.surfaceOpacity,
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
> & {
  hiddenNodesText: string;
  costIgnoredText: string;
};

function draftFromSettings(settings: ResolvedThemeSettings): ThemeDraft {
  const {
    hiddenNodes,
    costIgnoredNodes,
    ...rest
  } = pickManagedThemeSettings(settings);
  return {
    ...rest,
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

type ThemeTabId = "appearance" | "home" | "card" | "cost" | "ping";

const THEME_TABS: ReadonlyArray<{
  id: ThemeTabId;
  label: string;
  hint: string;
  icon: typeof LayoutTemplate;
}> = [
  { id: "appearance", label: "外观", hint: "外观、视图、背景媒体、透明度", icon: LayoutTemplate },
  { id: "home", label: "首页", hint: "总览、分组、排序、隐藏节点", icon: ListFilter },
  { id: "card", label: "卡片", hint: "卡片上显示哪些信息与悬浮窗", icon: Rows3 },
  { id: "cost", label: "花费", hint: "资产统计与收购溢价", icon: CircleDollarSign },
  { id: "ping", label: "延迟", hint: "多线路与逐节点指定", icon: Activity },
];

const DEFAULT_THEME_TAB: ThemeTabId = "appearance";

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
  const activeTab: ThemeTabId = isThemeTabId(tabParam) ? tabParam : DEFAULT_THEME_TAB;
  const [nodeSearch, setNodeSearch] = useState("");
  const [premiumSearch, setPremiumSearch] = useState("");
  const [savedLocally, setSavedLocally] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const draftThemeSettings = useMemo<ThemeSettings>(() => {
    const { hiddenNodesText, costIgnoredText, ...rest } = draft;
    return {
      ...rest,
      homepagePingBindings: pruneBindings(rest.homepagePingBindings),
      homeGroupOrder: normalizeHomeGroupOrder(rest.homeGroupOrder),
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

  const draftBgAlignment = useMemo(
    () => parseBackgroundAlignment(draft.backgroundAlignment),
    [draft.backgroundAlignment],
  );

  const setBgSize = (size: BackgroundSize) => {
    patch("backgroundAlignment", normalizeBackgroundAlignment({ size, position: draftBgAlignment.position }));
  };

  const setBgPosition = (position: BackgroundPosition) => {
    patch("backgroundAlignment", normalizeBackgroundAlignment({ size: draftBgAlignment.size, position }));
  };

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
      <header className="theme-topbar">
        <Link to="/" className="instance-page-back theme-topbar-back">
          <ArrowLeft size={14} />
          <span>返回首页</span>
        </Link>
        <h1 className="theme-topbar-title">SAO 主题设置</h1>
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
          {activeTab === "appearance" && (
            <>
              <InstancePanel
                id="set-appearance"
                kicker="外观"
                title="默认外观"
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
                id="set-view"
                kicker="视图"
                title="默认卡片视图"
                aside={<LayoutGrid size={16} />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="surface-inset setting-segment-slot flex flex-col gap-3 px-4 py-4">
                    <div>
                      <div className="setting-subhead-title">
                        桌面端默认
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
                        移动端默认
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

              <InstancePanel
                id="set-background"
                kicker="背景媒体"
                title="自定义背景图与动态视频"
                description="支持配置高质感壁纸或循环 MP4 视频背景（提供日夜双模适配）。"
                aside={<Wallpaper size={16} />}
              >
                <div className="flex flex-col gap-4">
                  <ToggleRow
                    field="enableBackgroundImage"
                    title="启用自定义背景媒体"
                    desc="开启后将覆盖站点默认背景，优先应用下方配置的图片或视频。"
                    checked={draft.enableBackgroundImage}
                    onPatch={patch}
                  />

                  {draft.enableBackgroundImage && (
                    <>
                      <div className="surface-inset flex flex-col gap-3 px-4 py-4">
                        <span className="setting-subhead-title">媒体形式</span>
                        <div className="instance-segmented is-prominent is-even">
                          {BACKGROUND_MEDIA_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                            <button
                              key={value}
                              type="button"
                              data-active={draft.backgroundMediaType === value ? "true" : "false"}
                              aria-pressed={draft.backgroundMediaType === value}
                              onClick={() => patch("backgroundMediaType", value)}
                              className="inline-flex items-center justify-center gap-2"
                            >
                              <Icon size={14} />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {draft.backgroundMediaType === "image" ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="surface-inset flex flex-col gap-2 px-4 py-3">
                            <span className="setting-subhead-title">桌面端背景图 URL</span>
                            <input
                              type="url"
                              value={draft.backgroundImage}
                              onChange={(event) => patch("backgroundImage", event.target.value)}
                              placeholder="https://example.com/desktop.jpg"
                              className="surface-inset px-3 py-2 text-[13px] outline-none"
                            />
                            <span className="setting-hint">宽屏与桌面端加载的背景图。</span>
                          </label>

                          <label className="surface-inset flex flex-col gap-2 px-4 py-3">
                            <span className="setting-subhead-title">移动端背景图 URL</span>
                            <input
                              type="url"
                              value={draft.backgroundImageMobile}
                              onChange={(event) => patch("backgroundImageMobile", event.target.value)}
                              placeholder="https://example.com/mobile.jpg"
                              className="surface-inset px-3 py-2 text-[13px] outline-none"
                            />
                            <span className="setting-hint">竖屏手机加载，留空则沿用桌面端。</span>
                          </label>

                          <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                            <span className="setting-subhead-title">平铺尺寸</span>
                            <div className="instance-segmented is-even">
                              {BACKGROUND_SIZE_OPTIONS.map(({ value, label }) => (
                                <button
                                  key={value}
                                  type="button"
                                  data-active={draftBgAlignment.size === value ? "true" : "false"}
                                  onClick={() => setBgSize(value)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                            <span className="setting-subhead-title">对齐位置</span>
                            <div className="instance-segmented is-even">
                              {BACKGROUND_POSITION_OPTIONS.map(({ value, label }) => (
                                <button
                                  key={value}
                                  type="button"
                                  data-active={draftBgAlignment.position === value ? "true" : "false"}
                                  onClick={() => setBgPosition(value)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="surface-inset flex flex-col gap-2 px-4 py-3">
                            <span className="setting-subhead-title">浅色模式视频 URL (MP4)</span>
                            <input
                              type="url"
                              value={draft.backgroundVideo}
                              onChange={(event) => patch("backgroundVideo", event.target.value)}
                              placeholder={DEFAULT_BACKGROUND_VIDEO_URL}
                              className="surface-inset px-3 py-2 text-[13px] outline-none"
                            />
                            <span className="setting-hint">留空使用 SAO 默认主题动态视频。</span>
                          </label>

                          <label className="surface-inset flex flex-col gap-2 px-4 py-3">
                            <span className="setting-subhead-title">深色模式视频 URL (MP4)</span>
                            <input
                              type="url"
                              value={draft.backgroundVideoDark}
                              onChange={(event) => patch("backgroundVideoDark", event.target.value)}
                              placeholder="可选，夜间专属视频"
                              className="surface-inset px-3 py-2 text-[13px] outline-none"
                            />
                            <span className="setting-hint">留空则在深色下自动叠加暗色暗场滤镜。</span>
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  <div className="surface-inset flex flex-col gap-3 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="setting-subhead-title">
                        卡片不透明度
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          inputMode="numeric"
                          value={draft.surfaceOpacity}
                          onChange={(event) => {
                            if (event.target.value.trim() === "") return;
                            const next = Number(event.target.value);
                            if (!Number.isFinite(next)) return;
                            patch("surfaceOpacity", Math.min(100, Math.max(0, Math.round(next))));
                          }}
                          aria-label="卡片不透明度百分比"
                          className="surface-inset w-20 px-3 py-2 text-right text-[13px] tabular outline-none"
                        />
                        <span className="text-[13px] font-medium text-(--text-tertiary)">%</span>
                      </span>
                    </div>
                    <span className="setting-hint">
                      输入 0–100 的整数。100 = 完全不透明，数值越低卡片越通透、越能透出背景媒体。
                      低于 95 时会自动叠加一层可读性遮罩，保证文字清晰。
                    </span>
                  </div>
                </div>
              </InstancePanel>
            </>
          )}

          {activeTab === "home" && (
            <>
              <InstancePanel
                id="set-home-overview"
                kicker="总览"
                title="首页顶部组件"
                aside={<ListFilter size={16} />}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleRow
                    field="showHomeOverview"
                    title="显示顶部总览栏"
                    desc="在首页顶部显示服务器总数、在线率、总流量与实时速率看板。"
                    checked={draft.showHomeOverview}
                    onPatch={patch}
                  />
                  <ToggleRow
                    field="showGroupTabs"
                    title="显示分组筛选栏"
                    desc="在卡片列表上方展示分组 Tab 快速筛选。"
                    checked={draft.showGroupTabs}
                    onPatch={patch}
                  />
                  <ToggleRow
                    field="showRegionBar"
                    title="显示地区筛选栏"
                    desc="在卡片列表上方展示国旗地区快捷标签。"
                    checked={draft.showRegionBar}
                    onPatch={patch}
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-(--border-color)">
                  <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                    管理员问候昵称（显示在首页顶部）
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={draft.adminNickname}
                    onChange={(e) => patch("adminNickname", e.target.value)}
                    placeholder="留空则自动读取面板后台用户名 (如 jerry)"
                    className="w-full px-3 py-2 text-sm rounded bg-(--input-bg,rgba(255,255,255,0.05)) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted)/50 focus:outline-none focus:border-(--accent)"
                  />
                  <p className="mt-1.5 text-xs text-(--text-muted)">
                    自定义首页顶部问候语显示的专属昵称（例如 <code>jerry</code>）。留空时将自动同步面板后端配置的真实用户名。
                  </p>
                </div>
              </InstancePanel>

              <InstancePanel
                id="set-home-sort"
                kicker="排序"
                title="排序规则与默认选中"
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
                      <span className="setting-subhead-title">默认排序字段</span>
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
                      <span className="setting-subhead-title">默认排序方向</span>
                      <SettingSelect
                        value={draft.homeSortDirection}
                        onChange={(event) =>
                          patch("homeSortDirection", event.target.value as "asc" | "desc")
                        }
                      >
                        <option value="asc">升序 (ASC)</option>
                        <option value="desc">降序 (DESC)</option>
                      </SettingSelect>
                    </div>
                  </div>

                  {availableGroups.length > 0 && (
                    <div className="surface-inset flex flex-col gap-3 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="setting-subhead-title">分组展示顺序</span>
                        <span className="setting-hint">使用上下箭头调整顺序</span>
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

              <InstancePanel
                id="set-hidden-nodes"
                kicker="过滤"
                title="隐藏节点"
                aside={<Search size={16} />}
              >
                <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                  <span className="setting-subhead-title">隐藏节点列表 (每行一个 UUID 或名称)</span>
                  <textarea
                    rows={4}
                    value={draft.hiddenNodesText}
                    onChange={(event) => patch("hiddenNodesText", event.target.value)}
                    placeholder="node-uuid-1&#10;Tokyo Edge"
                    className="surface-inset p-3 text-[13px] font-mono outline-none"
                  />
                  <span className="setting-hint">
                    列在此处的节点将不会在首页及总览中展示。当前已生效 {draftHiddenNodes.length} 台。
                  </span>
                </div>
              </InstancePanel>
            </>
          )}

          {activeTab === "card" && (
            <InstancePanel
              id="set-card-content"
              kicker="卡片"
              title="卡片展示内容"
              description="定制大卡片、小卡片和列表模式下呈现的具体指标。"
              aside={<Rows3 size={16} />}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  field="showCardGroup"
                  title="显示节点分组标签"
                  desc="在卡片副标题处标明其所属分组。"
                  checked={draft.showCardGroup}
                  onPatch={patch}
                />
                <ToggleRow
                  field="showCardPrice"
                  title="显示价格与到期日"
                  desc="在卡片中显示续费周期、费用和到期倒计时。"
                  checked={draft.showCardPrice}
                  onPatch={patch}
                />
                <ToggleRow
                  field="compactShowTrafficTotal"
                  title="小卡片显示累计流量"
                  desc="在紧凑视图中展示月度或累计出入站流量。"
                  checked={draft.compactShowTrafficTotal}
                  onPatch={patch}
                />
                <ToggleRow
                  field="compactShowBilling"
                  title="小卡片显示计费周期"
                  desc="在紧凑视图中保留周期标注。"
                  checked={draft.compactShowBilling}
                  onPatch={patch}
                />
                <ToggleRow
                  field="compactShowUptime"
                  title="小卡片显示在线时长"
                  desc="在紧凑视图中展示系统运行时间。"
                  checked={draft.compactShowUptime}
                  onPatch={patch}
                />
                <ToggleRow
                  field="showConnections"
                  title="显示 TCP/UDP 连接数"
                  desc="在卡片网络区域标注实时活跃连接统计。"
                  checked={draft.showConnections}
                  onPatch={patch}
                />
              </div>
            </InstancePanel>
          )}

          {activeTab === "cost" && (
            <>
              <InstancePanel
                id="set-cost"
                kicker="资产"
                title="资产与财务设置"
                aside={<CircleDollarSign size={16} />}
              >
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <ToggleRow
                      field="showCostSummary"
                      title="显示资产页入口按钮"
                      desc="在首页资产概览卡右上角显示进入资产统计页的按钮。"
                      checked={draft.showCostSummary}
                      onPatch={patch}
                    />
                    <ToggleRow
                      field="showCostSummaryFloatingButton"
                      title="显示资产悬浮按钮"
                      desc="卡内入口不可用时（总览隐藏或其开关关闭），以悬浮按钮进入资产统计页。"
                      checked={draft.showCostSummaryFloatingButton}
                      onPatch={patch}
                    />
                    <ToggleRow
                      field="showPriceForGuests"
                      title="向访客公开价格与资产"
                      desc="默认关闭。开启后，未登录访客也能查看节点续费价格标签与首页资产概览；关闭时对访客隐藏价格标签，资产概览显示为 保密。"
                      checked={draft.showPriceForGuests}
                      onPatch={patch}
                    />
                    <ToggleRow
                      field="showAssetRating"
                      title="显示资产评级徽章"
                      desc="在首页资产总值卡片右下角展示等级徽章（如 入门、标准）。"
                      checked={draft.showAssetRating}
                      onPatch={patch}
                    />
                  </div>

                  <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                    <span className="setting-subhead-title">资产评级自定义标签</span>
                    <input
                      type="text"
                      value={draft.assetRatingLabels}
                      onChange={(event) => patch("assetRatingLabels", event.target.value)}
                      placeholder="入门,标准,顶级,富佬"
                      className="surface-inset px-3 py-2 text-[13px] outline-none"
                    />
                    <span className="setting-hint">
                      从低到高 4 个等级，以英文逗号分隔（默认：入门,标准,顶级,富佬）。对应阶梯为 ≤500元、≤1500元、≤3000元、&gt;3000元。
                    </span>
                  </div>

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
                      <span className="setting-subhead-title">实时汇率接口 API URL</span>
                      <input
                        type="url"
                        value={draft.costRateApiUrl}
                        onChange={(event) => patch("costRateApiUrl", event.target.value)}
                        placeholder="https://open.er-api.com/v6/latest/CNY"
                        className="surface-inset px-3 py-2 text-[13px] outline-none"
                      />
                      <span className="setting-hint">留空使用官方默认免费公共汇率接口。</span>
                    </label>
                  </div>

                  <div className="surface-inset flex flex-col gap-2 px-4 py-3">
                    <span className="setting-subhead-title">忽略计算费用的节点</span>
                    <textarea
                      rows={3}
                      value={draft.costIgnoredText}
                      onChange={(event) => patch("costIgnoredText", event.target.value)}
                      placeholder="测试机&#10;node-uuid"
                      className="surface-inset p-3 text-[13px] font-mono outline-none"
                    />
                    <span className="setting-hint">每行一个节点 UUID 或名称，计入资产时不摊销其成本。</span>
                  </div>
                </div>
              </InstancePanel>

              <InstancePanel
                id="set-premiums"
                kicker="溢价"
                title="二手买入溢价/折价固化"
                description="记录收购时的实际支出，系统自动算出折价盈亏并在到期日前线性摊销。"
                aside={<CircleDollarSign size={16} />}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <input
                      value={premiumSearch}
                      onChange={(event) => setPremiumSearch(event.target.value)}
                      placeholder="搜索节点录入收购价…"
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

          {activeTab === "ping" && (
            <>
              <InstancePanel
                id="set-ping-mode"
                kicker="线路"
                title="延迟探测模式"
                aside={<Activity size={16} />}
              >
                <div className="flex flex-col gap-4">
                  <div className="surface-inset flex flex-col gap-3 px-4 py-4">
                    <span className="setting-subhead-title">首页探测展示模式</span>
                    <div className="instance-segmented is-prominent is-even is-stack-mobile">
                      <button
                        type="button"
                        data-active={!draft.enableHomepageMultiPing ? "true" : "false"}
                        onClick={() => patch("enableHomepageMultiPing", false)}
                      >
                        单线路模式 (指定主线路)
                      </button>
                      <button
                        type="button"
                        data-active={draft.enableHomepageMultiPing ? "true" : "false"}
                        onClick={() => patch("enableHomepageMultiPing", true)}
                      >
                        多线路模式 (并列展示三网/自定义线路)
                      </button>
                    </div>
                  </div>

                  {draft.enableHomepageMultiPing ? (
                    <div className="surface-inset flex flex-col gap-3 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="setting-subhead-title">多线路槽位展示列表</span>
                          <p className="setting-hint mt-1">
                            卡片将依序渲染这些线路的实时延迟柱条或色块。
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
                        <span className="setting-subhead-title">全局默认探测线路</span>
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
                        title="未绑定线路时模拟平滑延迟"
                        desc="避免部分节点空缺无条形码时影响整体美观（仅视觉平滑占位）。"
                        checked={draft.fakePingForUnbound}
                        onPatch={patch}
                      />

                      <div className="flex flex-col gap-3">
                        <span className="setting-subhead-title">
                          逐节点指定线路 (已指定 {assignedNodeCount} 台)
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
