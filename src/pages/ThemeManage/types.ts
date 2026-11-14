import type { MatrixColorTheme, MatrixBootEffect } from "@/types/cfsm";
import type { OverviewCardVisualMode } from "@/types/cfsm";
import type { pickManagedThemeSettings } from "./utils";

export type ThemeTabId = "home" | "card" | "cost" | "other" | "feedback";

export interface ColorThemeOption {
  id: MatrixColorTheme;
  label: string;
  badge: string;
  desc: string;
  colors: [string, string, string, string];
  badgeClass: string;
}

export interface BootEffectOption {
  id: MatrixBootEffect;
  label: string;
  badge: string;
  desc: string;
  badgeClass: string;
}

export interface OverviewVisualModeOption {
  id: OverviewCardVisualMode;
  label: string;
  desc: string;
}

export type ManagedThemeSettings = ReturnType<typeof pickManagedThemeSettings>;

export type ThemeDraft = Omit<
  ManagedThemeSettings,
  | "hiddenNodes"
  | "costIgnoredNodes"
  | "bandwidthRatingLabels"
> & {
  ratingLabels: {
    bandwidth: string;
  };
  hiddenNodesText: string;
  costIgnoredText: string;
};

export type BooleanDraftKey = {
  [K in keyof ThemeDraft]: ThemeDraft[K] extends boolean ? K : never;
}[keyof ThemeDraft];

