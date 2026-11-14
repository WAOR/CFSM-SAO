import {
  Sun,
  SunMoon,
  Moon,
  Square,
  LayoutGrid,
  Grid3x3,
  List,
  ListFilter,
  Server,
  CircleDollarSign,
  Sliders,
  HelpCircle,
} from "lucide-react";
import type { ThemeTabId, ColorThemeOption, BootEffectOption } from "./types";
import type { PingLatencyColors, PingOverviewBucket } from "@/types/cfsm";
import {
  DEFAULT_PING_LATENCY_COLORS,
  DEFAULT_PING_LOSS_COLORS,
  DEFAULT_TRAFFIC_SPECTRUM_COLORS,
} from "@/utils/themeSettings";

export const COLOR_THEME_OPTIONS: ColorThemeOption[] = [
  {
    id: "default",
    label: "经典标准",
    badge: "CLASSIC",
    desc: "绿 / 橙 / 红 经典监控配色，状态一目了然",
    colors: ["rgba(16, 185, 129, 0.28)", "#22c55e", "#f59e0b", "#ef4444"],
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    id: "eva",
    label: "EVA 初号机",
    badge: "EVA UNIT-01",
    desc: "机体紫配荧光绿，经典动漫科幻撞色",
    colors: ["#7c3aed", "#00ff66", "#f97316", "#ef4444"],
    badgeClass: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  },
  {
    id: "divergence",
    label: "命运石之门",
    badge: "1.048596%",
    desc: "复古辉光管暖橙色，温暖护眼耐看",
    colors: ["#fdba74", "#f97316", "#ea580c", "#ef4444"],
    badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30",
  },
];

export const BOOT_EFFECT_OPTIONS: BootEffectOption[] = [
  {
    id: "laser-scan",
    label: "激光扫描",
    badge: "RADAR",
    desc: "光束从左到右水平扫过，平滑显现卡片",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    id: "digital-rain",
    label: "代码瀑布",
    badge: "CASCADE",
    desc: "像代码雨一样，卡片自上而下逐行倾泻浮现",
    badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30",
  },
  {
    id: "cyber-glitch",
    label: "数码闪烁",
    badge: "OVERCLOCK",
    desc: "科技感数码噪点快速闪烁后定格",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border-fuchsia-500/30",
  },
  {
    id: "divergence-flux",
    label: "数字跳变",
    badge: "1.048596%",
    desc: "像辉光管数字快速滚动跳动后定格",
    badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30",
  },
];

export const APPEARANCE_OPTIONS = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "system", label: "跟随系统", icon: SunMoon },
  { value: "dark", label: "深色", icon: Moon },
] as const;

export const NODE_VIEW_MODE_OPTIONS = [
  { value: "large", label: "大卡片", icon: Square },
  { value: "compact", label: "小卡片", icon: LayoutGrid },
  { value: "mini", label: "迷你卡片", icon: Grid3x3 },
  { value: "list", label: "列表", icon: List },
] as const;

export const MOBILE_VIEW_MODE_OPTIONS = NODE_VIEW_MODE_OPTIONS.filter((option) => option.value !== "list");

export const THEME_TABS: ReadonlyArray<{
  id: ThemeTabId;
  label: string;
  hint: string;
  icon: typeof ListFilter;
}> = [
  { id: "home", label: "总览", hint: "顶部大盘与核心指标卡池", icon: ListFilter },
  { id: "card", label: "服务器", hint: "卡片样式、排序与网络延迟", icon: Server },
  { id: "cost", label: "资产", hint: "费用汇率与二手溢价", icon: CircleDollarSign },
  { id: "other", label: "其他", hint: "访客默认外观与全局设置", icon: Sliders },
  { id: "feedback", label: "帮助", hint: "常见问题与建议反馈", icon: HelpCircle },
];

export const PROJECT_REPOS = [
  {
    id: "komari",
    name: "Komari SAO",
    tag: "Komari",
    repo: "WAOR/Komari-Theme-SAO",
    url: "https://github.com/WAOR/Komari-Theme-SAO",
    issuesUrl: "https://github.com/WAOR/Komari-Theme-SAO/issues",
    newIssueUrl: "https://github.com/WAOR/Komari-Theme-SAO/issues/new",
    desc: "服务于探针数据呈现本身的高自由度模块化主题",
    isCurrent: false,
  },
  {
    id: "monitor",
    name: "Monitor SAO",
    tag: "Monitor 极简探针",
    repo: "WAOR/Monitor-SAO",
    url: "https://github.com/WAOR/Monitor-SAO",
    issuesUrl: "https://github.com/WAOR/Monitor-SAO/issues",
    newIssueUrl: "https://github.com/WAOR/Monitor-SAO/issues/new",
    desc: "服务于探针数据呈现本身的高自由度模块化主题",
    isCurrent: false,
  },
  {
    id: "cfsm",
    name: "CFSM SAO",
    tag: "Cloudflare Server Monitor",
    repo: "WAOR/CFSM-SAO",
    url: "https://github.com/WAOR/CFSM-SAO",
    issuesUrl: "https://github.com/WAOR/CFSM-SAO/issues",
    newIssueUrl: "https://github.com/WAOR/CFSM-SAO/issues/new",
    desc: "服务于探针数据呈现本身的高自由度模块化主题",
    isCurrent: true,
  },
] as const;

export const DEFAULT_THEME_TAB: ThemeTabId = "home";

export function isThemeTabId(value: string | null): value is ThemeTabId {
  return value != null && THEME_TABS.some((tab) => tab.id === value);
}

export const BODY_BOTTOM_GAP = 2;
export const MIN_BODY_HEIGHT = 320;

export interface LatencyTierConfig {
  key: keyof PingLatencyColors;
  label: string;
  hint: string;
  defaultColor: string;
}

export const LATENCY_TIER_CONFIG: readonly LatencyTierConfig[] = [
  { key: "excellent" as const, label: "极佳 (<=)", hint: "最优网络，极低延迟", defaultColor: DEFAULT_PING_LATENCY_COLORS.excellent },
  { key: "good" as const, label: "良好 (<=)", hint: "畅快体验，稳定流畅", defaultColor: DEFAULT_PING_LATENCY_COLORS.good },
  { key: "moderate" as const, label: "轻度 (<=)", hint: "轻度感知，正常可接受", defaultColor: DEFAULT_PING_LATENCY_COLORS.moderate },
  { key: "elevated" as const, label: "偏高 (<=)", hint: "较高延迟，可明显感知", defaultColor: DEFAULT_PING_LATENCY_COLORS.elevated },
  { key: "critical" as const, label: "极高", hint: "严重延迟，极度拥堵或告警", defaultColor: DEFAULT_PING_LATENCY_COLORS.critical },
] as const;

export const LOSS_TIER_CONFIG = [
  { key: "zero" as const, label: "无丢包 (0%)", hint: "网络通畅，零样本丢失", defaultColor: DEFAULT_PING_LOSS_COLORS.zero },
  { key: "low" as const, label: "轻微丢包", hint: "偶发微量丢包，基本可用", defaultColor: DEFAULT_PING_LOSS_COLORS.low },
  { key: "medium" as const, label: "中度丢包", hint: "较明显持续丢包，需注意", defaultColor: DEFAULT_PING_LOSS_COLORS.medium },
  { key: "high" as const, label: "严重丢包", hint: "严重丢包甚至失联脱网", defaultColor: DEFAULT_PING_LOSS_COLORS.high },
] as const;

export const TRAFFIC_SPECTRUM_ANCHOR_CONFIG = [
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

export const PREVIEW_LATENCY_BUCKETS: PingOverviewBucket[] = [
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

export const PREVIEW_LOSS_BUCKETS: PingOverviewBucket[] = [
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

