import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
} from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import type { OverviewData } from "@/components/node/OverviewStatCard";
import { useHomeNodeSummaries } from "@/hooks/useNode";
import { getNodeMetricsSnapshot } from "@/services/wsStore";
import { useCarrierNames, usePublicConfig } from "@/hooks/usePublicConfig";
import { useHourlyClock } from "@/hooks/useClock";
import { useThemeUpdate } from "@/hooks/useThemeUpdate";
import { usePreferences } from "@/hooks/usePreferences";
import { useAllPingOverview } from "@/hooks/usePingOverview";
import { calculateCarrierLoss } from "@/utils/carrierLoss";
import { useSiteThemeSyncStatus } from "@/hooks/useSiteThemeOptions";
import { getNodes } from "@/services/api";
import { carrierPingTasks } from "@/services/cfsm/mappers";
import { getLocalThemeSettings } from "@/services/themeSettingsStore";
import {
  calculateCostSummary,
  getExchangeRates,
  readCachedExchangeRates,
} from "@/utils/cost";
import { buildTrafficQuotaSegmentColors } from "@/utils/metricTone";
import { useThemeManageDraft } from "./useThemeManageDraft";
import type { ThemeTabId } from "./types";
import {
  THEME_TABS,
  DEFAULT_THEME_TAB,
  isThemeTabId,
  BODY_BOTTOM_GAP,
  MIN_BODY_HEIGHT,
} from "./constants";
import {
  filterClients,
  invertBindings,
  localDateInputMax,
  sortClients,
  sortTasks,
} from "./utils";
import {
  dedupeGroupLabels,
  sortHomeGroupOptions,
} from "@/utils/homeNodes";
import {
  HOMEPAGE_MULTI_PING_MAX_COUNT,
  HOMEPAGE_MULTI_PING_MIN_COUNT,
  isHomepageMultiPingConfigured,
} from "@/utils/pingTasks";
import { normalizeThemeSettings } from "@/utils/themeSettings";

import { SiteSyncIndicator } from "./components/SiteSyncIndicator";
import { OverviewTab } from "./tabs/OverviewTab";
import { ServerTab } from "./tabs/ServerTab";
import { CostTab } from "./tabs/CostTab";
import { OtherTab } from "./tabs/OtherTab";
import { HelpTab } from "./tabs/HelpTab";

export function ThemeManage() {
  const now = useHourlyClock();
  const { currentVersion, hasUpdate } = useThemeUpdate();
  const { setAppearance } = usePreferences();
  const {
    data: config,
    isLoading: configLoading,
    error: configError,
    refetch: refetchConfig,
  } = usePublicConfig();
  const carrierNames = useCarrierNames();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const allMeta = sortedClients;

  const initialSourceSettings = useMemo(() => {
    const raw = {
      ...(config?.theme_settings ?? {}),
      ...getLocalThemeSettings(),
    };
    return normalizeThemeSettings(raw);
  }, [config?.theme_settings]);

  const premiumRateQuery = useQuery({
    queryKey: ["cost-rates", initialSourceSettings.costRateApiUrl],
    queryFn: ({ signal }) => getExchangeRates(initialSourceSettings.costRateApiUrl, { signal }),
    initialData: () =>
      readCachedExchangeRates(initialSourceSettings.costRateApiUrl, true) ?? undefined,
    staleTime: 60 * 60 * 1000,
    enabled: allMeta.length > 0,
    retry: 1,
  });

  const {
    draft,
    patch,
    patchBindings,
    patchPingLatencyThreshold,
    patchPingLatencyColor,
    resetPingLatency,
    patchPingLossThreshold,
    patchPingLossColor,
    resetPingLoss,
    patchTrafficSpectrumColor,
    applyStatusBarPreset,
    resetTrafficSpectrum,
    patchMultiPingTask,
    removeMultiPingTask,
    addMultiPingTask,
    patchPremiumPaid,
    patchPremiumAcquiredAt,
    setRatingLabelDraft,
    draftSignature,
    sourceSignature,
    isDirty,
    draftCostRateApiUrlInvalid,
    draftMultiPingInvalid,
    draftHiddenNodes,
    draftCostIgnoredNodes,
    premiumDetailByUuid,
  } = useThemeManageDraft({
    config,
    allMeta,
    premiumRates: premiumRateQuery.data?.rates,
    now,
    sortedTasks,
  });

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const tabParam = searchParams.get("tab");
  const normalizedTab = tabParam === "ping" ? "card" : tabParam;
  const activeTab: ThemeTabId = isThemeTabId(normalizedTab) ? normalizedTab : DEFAULT_THEME_TAB;
  const [nodeSearch, setNodeSearch] = useState("");
  const [premiumSearch, setPremiumSearch] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error] = useState<string | null>(null);

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

  const siteSync = useSiteThemeSyncStatus();

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

  const previewTrafficSegmentColors = useMemo(
    () => buildTrafficQuotaSegmentColors(draft.trafficSpectrumColors),
    [draft.trafficSpectrumColors],
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

  const nodeSummaries = useHomeNodeSummaries();
  const allPing = useAllPingOverview();
  const isMultiPingConfigured =
    draft.enableHomepageMultiPing &&
    isHomepageMultiPingConfigured(draft.homepageMultiPingTaskIds);

  const carrierLoss = useMemo(() => {
    if (!isMultiPingConfigured) {
      return {
        peakLoss: null,
        avgLoss: null,
        ct: { loss: null, count: 0 },
        cu: { loss: null, count: 0 },
        cm: { loss: null, count: 0 },
        hasAnyData: false,
        isMultiPingMode: false,
      };
    }
    const hasIncludedFilter =
      Array.isArray(draft.carrierLossIncludedNodes) && draft.carrierLossIncludedNodes.length > 0;

    let targetNodes = allMeta;
    if (hasIncludedFilter) {
      const includedSet = new Set(draft.carrierLossIncludedNodes);
      targetNodes = allMeta.filter(
        (node) => includedSet.has(node.uuid) || (node.name && includedSet.has(node.name)),
      );
    }
    const targetUuids = targetNodes.map((node) => node.uuid);

    return calculateCarrierLoss(
      allPing.multiLines,
      allPing.singleItems,
      targetUuids,
      true,
    );
  }, [allPing.multiLines, allPing.singleItems, isMultiPingConfigured, draft.carrierLossIncludedNodes, allMeta]);

  const realOverview = useMemo<OverviewData | undefined>(() => {
    let onlineNodes = 0;
    let offlineNodes = 0;
    let trafficUp = 0;
    let trafficDown = 0;
    let netUp = 0;
    let netDown = 0;
    let totalCpu = 0;
    let totalRamUsed = 0;
    let totalRamTotal = 0;
    let totalDiskUsed = 0;
    let totalDiskTotal = 0;
    let totalTcpConn = 0;
    let totalUdpConn = 0;
    let totalSwapUsed = 0;
    let totalSwapTotal = 0;
    let totalProcesses = 0;

    if (nodeSummaries && nodeSummaries.length > 0) {
      for (const node of nodeSummaries) {
        const metrics = getNodeMetricsSnapshot(node.uuid);
        if (node.online === true) {
          onlineNodes++;
          totalCpu += node.cpuPct || 0;
          totalRamUsed += node.ramUsed || 0;
          totalDiskUsed += node.diskUsed || 0;
          totalTcpConn += node.tcpConn || 0;
          totalUdpConn += node.udpConn || 0;
          if (metrics) {
            totalSwapUsed += metrics.swapUsed || 0;
            totalProcesses += metrics.process || 0;
          }
        } else if (node.online === false) {
          offlineNodes++;
        }

        totalRamTotal += node.ramTotal || 0;
        totalDiskTotal += node.diskTotal || 0;
        if (metrics) {
          totalSwapTotal += metrics.swapTotal || 0;
        }
        trafficUp += node.trafficUp || 0;
        trafficDown += node.trafficDown || 0;
        netUp += node.netUp || 0;
        netDown += node.netDown || 0;
      }
    } else {
      for (const meta of allMeta) {
        onlineNodes++;
        totalCpu += 22;
        totalRamUsed += (meta.mem_total || 4096 * 1024 * 1024) * 0.45;
        totalDiskUsed += (meta.disk_total || 60000 * 1024 * 1024) * 0.38;
        totalTcpConn += 36;
        totalUdpConn += 8;
        totalRamTotal += meta.mem_total || 4096 * 1024 * 1024;
        totalDiskTotal += meta.disk_total || 60000 * 1024 * 1024;
        trafficUp += 1024 * 1024 * 1024 * 60;
        trafficDown += 1024 * 1024 * 1024 * 180;
        netUp += 1024 * 480;
        netDown += 1024 * 1600;
      }
    }

    const totalNodes = onlineNodes + offlineNodes;
    const avgCpu = onlineNodes > 0 ? totalCpu / onlineNodes : 0;
    const totalCores = allMeta.length > 0 ? allMeta.reduce((sum, n) => sum + (n.cpu_cores || 0), 0) : 0;
    const swapPct = totalSwapTotal > 0 ? (totalSwapUsed / totalSwapTotal) * 100 : 0;

    let maxUptimeSeconds = 0;
    let minUptimeSeconds = Number.POSITIVE_INFINITY;
    let recentRebootNode: { name: string; seconds: number } | null = null;

    for (const meta of allMeta) {
      const metrics = getNodeMetricsSnapshot(meta.uuid);
      if (metrics && metrics.online === true && Number.isFinite(metrics.uptime) && metrics.uptime > 0) {
        if (metrics.uptime > maxUptimeSeconds) {
          maxUptimeSeconds = metrics.uptime;
        }
        if (metrics.uptime < minUptimeSeconds) {
          minUptimeSeconds = metrics.uptime;
          recentRebootNode = {
            name: meta.name?.trim() || meta.uuid,
            seconds: metrics.uptime,
          };
        }
      }
    }

    return {
      totalNodes,
      onlineNodes,
      offlineNodes,
      trafficUp,
      trafficDown,
      netUp,
      netDown,
      avgCpu,
      totalRamUsed,
      totalRamTotal,
      ramPct: totalRamTotal > 0 ? (totalRamUsed / totalRamTotal) * 100 : 0,
      totalDiskUsed,
      totalDiskTotal,
      diskPct: totalDiskTotal > 0 ? (totalDiskUsed / totalDiskTotal) * 100 : 0,
      totalTcpConn,
      totalUdpConn,
      maxUptimeSeconds,
      recentRebootNode,
      totalSwapUsed,
      totalSwapTotal,
      swapPct,
      totalProcesses,
      totalCores,
      carrierLoss,
    };
  }, [nodeSummaries, allMeta, carrierLoss]);

  const realCostSummary = useMemo(() => {
    if (!premiumRateQuery.data) return undefined;
    return calculateCostSummary(
      allMeta,
      draftCostIgnoredNodes,
      premiumRateQuery.data.rates,
      draft.costPremiums,
      now,
    );
  }, [allMeta, draftCostIgnoredNodes, draft.costPremiums, now, premiumRateQuery.data]);

  useEffect(() => {
    if (isDirty) setMessage(null);
  }, [isDirty]);

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

  const draftAwaitingAutoSave = draftSignature !== sourceSignature;

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
          <SiteSyncIndicator
            phase={siteSync.phase}
            invalid={isDirty && (draftCostRateApiUrlInvalid || draftMultiPingInvalid)}
            waiting={draftAwaitingAutoSave}
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
              <span className="theme-tab-label">
                {label}
                {id === "feedback" && hasUpdate && (
                  <span className="theme-tab-badge-dot" aria-label="有新版本更新" />
                )}
              </span>
              <span className="theme-tab-hint">{hint}</span>
            </button>
          ))}
        </nav>

        <div className="theme-manage-sections" ref={sectionsRef}>
          {activeTab === "home" && (
            <OverviewTab
              draft={draft}
              patch={patch}
              showToast={showToast}
              setRatingLabelDraft={setRatingLabelDraft}
              realOverview={realOverview}
              realCostSummary={realCostSummary}
              allMeta={allMeta}
              exchangeRates={premiumRateQuery.data?.rates}
            />
          )}

          {activeTab === "card" && (
            <ServerTab
              draft={draft}
              patch={patch}
              patchBindings={patchBindings}
              patchPingLatencyThreshold={patchPingLatencyThreshold}
              patchPingLatencyColor={patchPingLatencyColor}
              resetPingLatency={resetPingLatency}
              patchPingLossThreshold={patchPingLossThreshold}
              patchPingLossColor={patchPingLossColor}
              resetPingLoss={resetPingLoss}
              patchTrafficSpectrumColor={patchTrafficSpectrumColor}
              applyStatusBarPreset={applyStatusBarPreset}
              resetTrafficSpectrum={resetTrafficSpectrum}
              patchMultiPingTask={patchMultiPingTask}
              removeMultiPingTask={removeMultiPingTask}
              addMultiPingTask={addMultiPingTask}
              previewTrafficSegmentColors={previewTrafficSegmentColors}
              multiPingSlotLimit={multiPingSlotLimit}
              sortedTasks={sortedTasks}
              clientsById={clientsById}
              availableGroups={availableGroups}
              orderedDraftGroups={orderedDraftGroups}
              moveGroup={moveGroup}
              visibleClients={visibleClients}
              draftHiddenNodes={draftHiddenNodes}
              assignedNodeCount={assignedNodeCount}
              assignedTaskByClientUuid={assignedTaskByClientUuid}
              expandedTaskId={expandedTaskId}
              toggleTaskExpanded={toggleTaskExpanded}
              nodeSearch={nodeSearch}
              setNodeSearch={setNodeSearch}
            />
          )}

          {activeTab === "cost" && (
            <CostTab
              draft={draft}
              patch={patch}
              draftCostRateApiUrlInvalid={draftCostRateApiUrlInvalid}
              premiumSearch={premiumSearch}
              setPremiumSearch={setPremiumSearch}
              filteredPremiumClients={filteredPremiumClients}
              premiumDetailByUuid={premiumDetailByUuid}
              rateLoading={premiumRateQuery.isLoading}
              acquiredAtMax={acquiredAtMax}
              patchPremiumPaid={patchPremiumPaid}
              patchPremiumAcquiredAt={patchPremiumAcquiredAt}
            />
          )}

          {activeTab === "other" && (
            <OtherTab
              draft={draft}
              patch={patch}
              setAppearance={setAppearance}
            />
          )}

          {activeTab === "feedback" && (
            <HelpTab
              currentVersion={currentVersion}
              hasUpdate={hasUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
