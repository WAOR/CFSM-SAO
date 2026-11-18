import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  NodeInfo,
  PingLatencyColors,
  PingLatencyThresholds,
  PingLossColors,
  PingLossThresholds,
  PingTask,
  PublicConfig,
  ThemeSettings,
  TrafficSpectrumColors,
} from "@/types/cfsm";
import {
  DEFAULT_PING_LATENCY_COLORS,
  DEFAULT_PING_LATENCY_THRESHOLDS,
  DEFAULT_PING_LOSS_COLORS,
  DEFAULT_PING_LOSS_THRESHOLDS,
  DEFAULT_TRAFFIC_SPECTRUM_COLORS,
  normalizeThemeSettings,
  type ResolvedThemeSettings,
  type StatusBarPreset,
} from "@/utils/themeSettings";
import {
  calculateCostPremiumAmount,
  calculateCostPremiumBasisAt,
  calculateCostSummary,
  isCostRateApiUrlValid,
  normalizeCostIgnoredNodes,
} from "@/utils/cost";
import { normalizeNodeIdentityList } from "@/utils/nodeIdentity";
import {
  assignHomepageMultiPingTask,
  isHomepageMultiPingConfigured,
  normalizeHomepageMultiPingTaskIds,
  type HomepagePingTaskBindings,
} from "@/utils/pingTasks";
import { getLocalThemeSettings, saveLocalThemeSettings } from "@/services/themeSettingsStore";
import type { ThemeDraft } from "./types";
import {
  buildPremiumEntry,
  draftFromSettings,
  draftToThemeSettings,
  localDateInputMax,
  managedSettingsSignature,
  pickManagedThemeSettings,
} from "./utils";

const THEME_AUTO_SAVE_DEBOUNCE_MS = 600;

export function useThemeManageDraft({
  config,
  allMeta,
  premiumRates,
  now,
  sortedTasks,
}: {
  config: PublicConfig | undefined;
  allMeta: NodeInfo[];
  premiumRates: Record<string, number> | undefined;
  now: number;
  sortedTasks: PingTask[];
}) {
  const [searchParams] = useSearchParams();

  const sourceThemeSettings = useMemo(() => {
    const raw = {
      ...(config?.theme_settings ?? {}),
      ...getLocalThemeSettings(),
    };
    const norm = normalizeThemeSettings(raw);
    const paletteParam = searchParams.get("palette");
    if (paletteParam === "divergence" || paletteParam === "eva" || paletteParam === "default") {
      norm.matrixColorTheme = paletteParam;
    }
    const visualModeParam = searchParams.get("visualMode");
    if (visualModeParam === "adaptive" || visualModeParam === "visual" || visualModeParam === "text") {
      norm.overviewCardVisualMode = visualModeParam;
    }
    const microVisualParam = searchParams.get("microVisual");
    if (microVisualParam === "dynamic" || microVisualParam === "static") {
      norm.overviewMicroVisualMode = microVisualParam;
    }
    return norm;
  }, [config?.theme_settings, searchParams]);

  const sourceSignature = useMemo(
    () => JSON.stringify(pickManagedThemeSettings(sourceThemeSettings)),
    [sourceThemeSettings],
  );

  const [draft, setDraft] = useState<ThemeDraft>(() =>
    draftFromSettings(sourceThemeSettings),
  );
  const lastSeededSignatureRef = useRef<string | null>(config ? sourceSignature : null);

  const seedDrafts = useCallback((next: ResolvedThemeSettings) => {
    setDraft(draftFromSettings(next));
  }, []);

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

  const sortedTasksRef = useRef(sortedTasks);
  sortedTasksRef.current = sortedTasks;

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

  const premiumBasisAt = useCallback(
    (uuid: string, acquiredAt?: string): number | null => {
      if (!premiumRates) return null;
      return calculateCostPremiumBasisAt(
        allMeta,
        sourceThemeSettings.costIgnoredNodes,
        premiumRates,
        uuid,
        acquiredAt,
        now,
      );
    },
    [allMeta, now, premiumRates, sourceThemeSettings.costIgnoredNodes],
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

  const setRatingLabelDraft = useCallback((key: "bandwidth", value: string) => {
    editVersionRef.current += 1;
    setDraft((prev) => ({
      ...prev,
      ratingLabels: {
        ...prev.ratingLabels,
        [key]: value,
      },
    }));
  }, []);

  const draftThemeSettings = useMemo<ThemeSettings>(
    () => draftToThemeSettings(draft),
    [draft],
  );

  const draftSignature = useMemo(
    () => managedSettingsSignature(draftThemeSettings as ThemeSettings & Record<string, unknown>),
    [draftThemeSettings],
  );
  const costRateApiUrlDirty =
    draft.costRateApiUrl.trim() !== sourceThemeSettings.costRateApiUrl;
  const isDirty = draftSignature !== sourceSignature || costRateApiUrlDirty;

  const draftCostRateApiUrlInvalid =
    draft.costRateApiUrl.trim() !== "" && !isCostRateApiUrlValid(draft.costRateApiUrl.trim());
  const draftMultiPingInvalid =
    draft.enableHomepageMultiPing &&
    sortedTasks.length > 0 &&
    !isHomepageMultiPingConfigured(draft.homepageMultiPingTaskIds);

  const draftHiddenNodes = useMemo(
    () => normalizeNodeIdentityList(draft.hiddenNodesText),
    [draft.hiddenNodesText],
  );

  const draftCostIgnoredNodes = useMemo(
    () => normalizeCostIgnoredNodes(draft.costIgnoredText),
    [draft.costIgnoredText],
  );

  useLayoutEffect(() => {
    if (!config) return;
    if (lastSeededSignatureRef.current === sourceSignature) return;
    if (lastSeededSignatureRef.current !== null && isDirty) return;
    lastSeededSignatureRef.current = sourceSignature;
    seedDrafts(sourceThemeSettings);
  }, [config, isDirty, sourceSignature, sourceThemeSettings, seedDrafts]);

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

  const premiumDetailByUuid = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateCostSummary>["details"][number]>();
    if (!premiumRates) return map;
    const summary = calculateCostSummary(
      allMeta,
      sourceThemeSettings.costIgnoredNodes,
      premiumRates,
      undefined,
      now,
    );
    for (const detail of summary.details) map.set(detail.uuid, detail);
    return map;
  }, [allMeta, now, premiumRates, sourceThemeSettings.costIgnoredNodes]);

  return {
    sourceThemeSettings,
    sourceSignature,
    draft,
    setDraft,
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
    draftThemeSettings,
    draftSignature,
    isDirty,
    draftCostRateApiUrlInvalid,
    draftMultiPingInvalid,
    draftHiddenNodes,
    draftCostIgnoredNodes,
    premiumDetailByUuid,
  };
}
