import type { NodeInfo, PingTask, ThemeSettings } from "@/types/cfsm";
import type { CostPremiumEntry } from "@/utils/cost";
import {
  DEFAULT_HOMEPAGE_MULTI_PING_TASK_IDS,
  normalizeHomepagePingTaskBindings,
  type HomepagePingTaskBindings,
} from "@/utils/pingTasks";
import {
  normalizeOverviewCards,
  normalizePingLatencyColors,
  normalizePingLatencyThresholds,
  normalizePingLossColors,
  normalizePingLossThresholds,
  normalizeThemeSettings,
  normalizeTrafficSpectrumColors,
  type ResolvedThemeSettings,
} from "@/utils/themeSettings";
import {
  normalizeCostIgnoredNodes,
  normalizeCostPremiums,
  normalizeCostRateApiUrl,
} from "@/utils/cost";
import { normalizeNodeIdentityList } from "@/utils/nodeIdentity";
import { normalizeHomeGroupOrder } from "@/utils/homeNodes";
import type { ThemeDraft } from "./types";

export function localDateInputMax() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function sortTasks(tasks: PingTask[]) {
  return [...tasks].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    if (left.id !== right.id) return left.id - right.id;
    return left.name.localeCompare(right.name);
  });
}

export function buildPremiumEntry(
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

export function sortClients(clients: NodeInfo[]) {
  return [...clients].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    return left.name.localeCompare(right.name);
  });
}

export function filterClients(clients: NodeInfo[], rawKeyword: string) {
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

export function summarizeNodes(
  uuids: string[],
  clientsById: Map<string, NodeInfo>,
) {
  if (uuids.length === 0) return "点右侧「编辑节点」把节点加进来";
  const names = uuids.map((uuid) => clientsById.get(uuid)?.name || uuid);
  const summary = names.join("、");
  return summary.length > 92 ? `${summary.slice(0, 92)}...` : summary;
}

export function pruneBindings(bindings: HomepagePingTaskBindings) {
  const normalized = normalizeHomepagePingTaskBindings(bindings);
  const pruned: HomepagePingTaskBindings = {};

  for (const [taskId, clients] of Object.entries(normalized)) {
    if (clients.length > 0) {
      pruned[taskId] = clients;
    }
  }

  return pruned;
}

export function applyClientAssignment(
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

export function invertBindings(bindings: HomepagePingTaskBindings): Map<string, string> {
  const assignedTaskByClient = new Map<string, string>();
  for (const [taskId, clients] of Object.entries(bindings)) {
    for (const clientUuid of clients) {
      assignedTaskByClient.set(clientUuid, taskId);
    }
  }
  return assignedTaskByClient;
}

export function applyAvailableClientAssignments(
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

export function pickManagedThemeSettings(settings: ResolvedThemeSettings) {
  return {
    defaultAppearance: settings.defaultAppearance,
    desktopNodeViewMode: settings.desktopNodeViewMode,
    mobileNodeViewMode: settings.mobileNodeViewMode,
    serverCardTemplate: settings.serverCardTemplate,
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
    homepageMultiPingTaskIds:
      settings.homepageMultiPingTaskIds.length > 0
        ? settings.homepageMultiPingTaskIds
        : [...DEFAULT_HOMEPAGE_MULTI_PING_TASK_IDS],
    fakePingForUnbound: settings.fakePingForUnbound,
    pingLatencyThresholds: normalizePingLatencyThresholds(settings.pingLatencyThresholds),
    pingLatencyColors: normalizePingLatencyColors(settings.pingLatencyColors),
    pingLossThresholds: normalizePingLossThresholds(settings.pingLossThresholds),
    pingLossColors: normalizePingLossColors(settings.pingLossColors),
    trafficSpectrumColors: normalizeTrafficSpectrumColors(settings.trafficSpectrumColors),
    showHomeOverview: settings.showHomeOverview,
    overviewCards: settings.overviewCards,
    overviewCardVisualMode: settings.overviewCardVisualMode,
    overviewMicroVisualMode: settings.overviewMicroVisualMode,
    overviewStaticCards: settings.overviewStaticCards,
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
    showOverviewRatings: settings.showOverviewRatings,
    showBandwidthRating: settings.showBandwidthRating,
    bandwidthRatingLabels: settings.bandwidthRatingLabels,
    compactShowTrafficTotal: settings.compactShowTrafficTotal,
    compactShowBilling: settings.compactShowBilling,
    compactShowUptime: settings.compactShowUptime,
    showConnections: settings.showConnections,
    hiddenNodes: settings.hiddenNodes,
    carrierLossIncludedNodes: settings.carrierLossIncludedNodes,
    costIgnoredNodes: settings.costIgnoredNodes,
    costPremiums: Object.fromEntries(
      Object.keys(settings.costPremiums)
        .sort()
        .map((uuid) => [uuid, settings.costPremiums[uuid]]),
    ),
    costRateApiUrl: settings.costRateApiUrl,
    costCurrency: settings.costCurrency,
  };
}

export function managedSettingsSignature(settings: ThemeSettings & Record<string, unknown>) {
  return JSON.stringify(pickManagedThemeSettings(normalizeThemeSettings(settings)));
}

export function draftFromSettings(settings: ResolvedThemeSettings): ThemeDraft {
  const {
    hiddenNodes,
    costIgnoredNodes,
    bandwidthRatingLabels,
    ...rest
  } = pickManagedThemeSettings(settings);
  return {
    ...rest,
    overviewCards: normalizeOverviewCards(rest.overviewCards),
    ratingLabels: {
      bandwidth: bandwidthRatingLabels,
    },
    hiddenNodesText: hiddenNodes.join("\n"),
    costIgnoredText: costIgnoredNodes.join("\n"),
  };
}

export function draftToThemeSettings(targetDraft: ThemeDraft): ThemeSettings {
  const { ratingLabels, hiddenNodesText, costIgnoredText, ...rest } = targetDraft;
  return {
    ...rest,
    homepagePingBindings: pruneBindings(rest.homepagePingBindings),
    homeGroupOrder: normalizeHomeGroupOrder(rest.homeGroupOrder),
    bandwidthRatingLabels: ratingLabels.bandwidth,
    hiddenNodes: normalizeNodeIdentityList(hiddenNodesText),
    carrierLossIncludedNodes: normalizeNodeIdentityList(rest.carrierLossIncludedNodes),
    costIgnoredNodes: normalizeCostIgnoredNodes(costIgnoredText),
    costPremiums: normalizeCostPremiums(rest.costPremiums),
    costRateApiUrl: normalizeCostRateApiUrl(rest.costRateApiUrl),
    costCurrency: rest.costCurrency,
  };
}
