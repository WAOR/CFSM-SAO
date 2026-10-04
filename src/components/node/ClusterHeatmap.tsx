import { useState, useRef, useMemo, useEffect } from "react";
import { Flag } from "@/components/ui/Flag";
import { formatByteRateLabel } from "@/utils/format";
import type { HomeNodeSummary } from "@/services/wsStore";

interface ClusterHeatmapProps {
  nodes: HomeNodeSummary[];
  nameByUuid?: Map<string, string>;
  onlinePct: number;
  onlineNodes: number;
  offlineNodes: number;
  totalNodes: number;
  colorTheme?: "default" | "eva";
  mockFill?: boolean;
  bootAnimation?: boolean;
}

interface MockSlot {
  slotNumber: number;
  status: "idle" | "active";
  netUp: number;
  netDown: number;
  cpuPct: number;
  ramPct: number;
}

interface HoverState {
  node?: HomeNodeSummary;
  name: string;
  x: number;
  y: number;
  placement: "top" | "bottom";
  isEmpty?: boolean;
  slotIndex?: number;
  isMock?: boolean;
  mockSlot?: MockSlot;
}

// 恢复经典 20 列饱满大方格：单块尺寸约 20px，在独占版面下高度舒展，极具 GitHub 风格
const GRID_COLUMNS = 20;
// 默认铺满 5 行标准机架矩阵（即 100 槽），确保在节点少时也能用精致虚线槽位完整撑起状态卡片，
// 与实时网络吞吐双折线图卡片高度严格齐平对齐，避免上下大面积空旷留白与切换时跳高。
const MIN_RACK_ROWS = 5;

// 20 列 × 5 行点阵正体 "S A O"
// S: 列 2..5; A: 列 7..11; O: 列 13..17
export const SAO_PIXEL_INDICES = new Set<number>([
  // 行 0 (0..19)
  2, 3, 4, 5,       8, 9, 10,             14, 15, 16,
  // 行 1 (20..39)
  22,               27, 31,               33, 37,
  // 行 2 (40..59)
  42, 43, 44, 45,   47, 48, 49, 50, 51,   53, 57,
  // 行 3 (60..79)
  65,               67, 71,               73, 77,
  // 行 4 (80..99)
  82, 83, 84, 85,   87, 91,               94, 95, 96,
]);

// 网络吞吐阶梯定义（以字节每秒 B/s 为基准）：
// - 空闲待机 (idle): max(netUp, netDown) < 500 KB/s
// - 活跃传输 (active): 500 KB/s ~ 5 MB/s
// - 高吞吐 (high): >= 5 MB/s
export const THROUGHPUT_ACTIVE_BYTES = 500 * 1024; // 500 KB/s
export const THROUGHPUT_HIGH_BYTES = 5 * 1024 * 1024; // 5 MB/s

export type NodeThroughputStatus = "offline" | "unknown" | "high" | "active" | "idle";

export function resolveNodeThroughputStatus(node: HomeNodeSummary): {
  status: NodeThroughputStatus;
  statusClass: string;
  badgeText: string;
  badgeClass: string;
} {
  if (node.online === false) {
    return {
      status: "offline",
      statusClass: "is-offline",
      badgeText: "离线",
      badgeClass: "is-offline",
    };
  }
  if (node.online == null) {
    return {
      status: "unknown",
      statusClass: "is-unknown",
      badgeText: "未知",
      badgeClass: "is-unknown",
    };
  }

  const maxRate = Math.max(node.netUp ?? 0, node.netDown ?? 0);
  if (maxRate >= THROUGHPUT_HIGH_BYTES) {
    return {
      status: "high",
      statusClass: "is-high-load",
      badgeText: "高吞吐",
      badgeClass: "is-warning",
    };
  }
  if (maxRate >= THROUGHPUT_ACTIVE_BYTES) {
    return {
      status: "active",
      statusClass: "is-medium-load",
      badgeText: "活跃传输",
      badgeClass: "is-active",
    };
  }
  return {
    status: "idle",
    statusClass: "is-low-load",
    badgeText: "空闲待机",
    badgeClass: "is-idle",
  };
}

export function ClusterHeatmap({
  nodes,
  nameByUuid,
  onlinePct,
  onlineNodes,
  offlineNodes,
  totalNodes,
  colorTheme = "default",
  mockFill = false,
  bootAnimation = true,
}: ClusterHeatmapProps) {
  const [hoverInfo, setHoverInfo] = useState<HoverState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 开屏横扫点阵动效状态机
  const [bootPhase, setBootPhase] = useState<"idle" | "scan" | "hold" | "dissolve">("idle");
  const [scanCol, setScanCol] = useState<number>(-1);

  useEffect(() => {
    if (!bootAnimation) {
      setBootPhase("idle");
      return;
    }
    // 页面载入时从左向右横扫点亮正体 "SAO" 字符点阵，呼吸三下后平滑过渡至真实节点数据
    setBootPhase("scan");
    let current = 0;
    const interval = setInterval(() => {
      setScanCol(current);
      current++;
      if (current >= GRID_COLUMNS) {
        clearInterval(interval);
        setBootPhase("hold");
        // 呼吸三下（每次 600ms，共 1800ms）后进入平滑溶解阶段
        setTimeout(() => {
          setBootPhase("dissolve");
          setTimeout(() => {
            setBootPhase("idle");
          }, 350);
        }, 1800);
      }
    }, 24);

    return () => clearInterval(interval);
  }, [bootAnimation]);

  // 统计高吞吐节点数量（速率 >= 5 MB/s）
  const highThroughputCount = useMemo(() => {
    let count = 0;
    for (const node of nodes) {
      if (node.online === true) {
        const maxRate = Math.max(node.netUp ?? 0, node.netDown ?? 0);
        if (maxRate >= THROUGHPUT_HIGH_BYTES) {
          count++;
        }
      }
    }
    return count;
  }, [nodes]);

  // 计算填满整矩形所需的行数与空槽数（保证无缺角，且最少铺满 5 行 100 槽对齐带宽高度）
  const { totalSlots, emptySlotsCount } = useMemo(() => {
    const rows = Math.max(MIN_RACK_ROWS, Math.ceil(Math.max(nodes.length, 1) / GRID_COLUMNS));
    const total = rows * GRID_COLUMNS;
    return {
      totalSlots: total,
      emptySlotsCount: Math.max(0, total - nodes.length),
    };
  }, [nodes.length]);

  // 当开启 mockFill 时，为每个空闲槽位随机生成比例可变的「空闲待机」与「活跃传输」模拟数据
  // 随着页面刷新，Math.random() 产生新的分布与比例；在单次渲染周期中保持稳定
  const mockSlots: MockSlot[] = useMemo(() => {
    if (!mockFill || emptySlotsCount <= 0) return [];
    // 随机活跃比例：20% ~ 55%
    const activeProbability = 0.2 + Math.random() * 0.35;
    return Array.from({ length: emptySlotsCount }, (_, i) => {
      const slotNumber = nodes.length + i + 1;
      const isActive = Math.random() < activeProbability;
      if (isActive) {
        return {
          slotNumber,
          status: "active" as const,
          netUp: Math.round(600_000 + Math.random() * 2_000_000),
          netDown: Math.round(800_000 + Math.random() * 3_500_000),
          cpuPct: Math.round(15 + Math.random() * 45),
          ramPct: Math.round(35 + Math.random() * 50),
        };
      }
      return {
        slotNumber,
        status: "idle" as const,
        netUp: Math.round(5_000 + Math.random() * 250_000),
        netDown: Math.round(15_000 + Math.random() * 450_000),
        cpuPct: Math.round(1 + Math.random() * 15),
        ramPct: Math.round(15 + Math.random() * 40),
      };
    });
  }, [mockFill, emptySlotsCount, nodes.length]);

  // 根据单元格一维序号返回开屏动画样式类
  const getBootAnimationClass = (cellIndex: number): string => {
    if (bootPhase === "idle") return "";
    if (cellIndex >= 100) return "is-sao-unlit";
    const col = cellIndex % GRID_COLUMNS;
    const isSao = SAO_PIXEL_INDICES.has(cellIndex);

    if (bootPhase === "scan") {
      if (col === scanCol) return "is-sao-beam";
      if (col < scanCol) return isSao ? "is-sao-pixel" : "is-sao-bg";
      return "is-sao-unlit";
    }
    if (bootPhase === "hold") {
      return isSao ? "is-sao-pixel is-sao-glow" : "is-sao-bg";
    }
    if (bootPhase === "dissolve") {
      return "is-sao-dissolve";
    }
    return "";
  };

  const handleCellClick = (uuid: string) => {
    const el = document.getElementById(`node-card-${uuid}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-highlight-target");
      window.setTimeout(() => {
        el.classList.remove("is-highlight-target");
      }, 2000);
    }
  };

  const handleCellMouseEnter = (
    e: React.MouseEvent<HTMLButtonElement>,
    node: HomeNodeSummary,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!wrapRect) return;

    const rawX = rect.left - wrapRect.left + rect.width / 2;
    // 约束 X 坐标在 [115, wrapWidth - 115] 之间，防止悬浮卡片在边缘被裁切
    const clampedX = Math.max(115, Math.min(wrapRect.width - 115, rawX));
    const cellTopInWrap = rect.top - wrapRect.top;
    // 若方块处于靠顶端，则将浮层放置在方块正下方，否则放置在方块上方
    const isNearTop = cellTopInWrap < 42;
    const placement = isNearTop ? "bottom" : "top";
    const y = isNearTop ? rect.bottom - wrapRect.top + 6 : rect.top - wrapRect.top - 6;

    setHoverInfo({
      node,
      name: nameByUuid?.get(node.uuid) || node.uuid,
      x: clampedX,
      y,
      placement,
    });
  };

  const handleMockSlotMouseEnter = (
    e: React.MouseEvent<HTMLButtonElement>,
    slot: MockSlot,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!wrapRect) return;

    const rawX = rect.left - wrapRect.left + rect.width / 2;
    const clampedX = Math.max(115, Math.min(wrapRect.width - 115, rawX));
    const cellTopInWrap = rect.top - wrapRect.top;
    const isNearTop = cellTopInWrap < 42;
    const placement = isNearTop ? "bottom" : "top";
    const y = isNearTop ? rect.bottom - wrapRect.top + 6 : rect.top - wrapRect.top - 6;

    setHoverInfo({
      name: `机位插槽 #${slot.slotNumber}`,
      x: clampedX,
      y,
      placement,
      isMock: true,
      mockSlot: slot,
    });
  };

  const handleEmptySlotMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    slotIndex: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!wrapRect) return;

    const rawX = rect.left - wrapRect.left + rect.width / 2;
    const clampedX = Math.max(115, Math.min(wrapRect.width - 115, rawX));
    const cellTopInWrap = rect.top - wrapRect.top;
    const isNearTop = cellTopInWrap < 42;
    const placement = isNearTop ? "bottom" : "top";
    const y = isNearTop ? rect.bottom - wrapRect.top + 6 : rect.top - wrapRect.top - 6;

    setHoverInfo({
      name: `机位插槽 #${slotIndex}`,
      x: clampedX,
      y,
      placement,
      isEmpty: true,
      slotIndex,
    });
  };

  const handleCellMouseLeave = () => {
    setHoverInfo(null);
  };

  const isBooting = bootPhase !== "idle" && bootPhase !== "dissolve";

  return (
    <div
      className="mao-progress-section mao-matrix-section"
      data-palette={colorTheme === "eva" ? "eva" : "default"}
    >
      <div className="mao-progress-section-header">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="mao-progress-big-num">{onlinePct.toFixed(0)}%</span>
          <span className="mao-progress-unit-label">在线率</span>
        </div>
        <div className="flex items-center gap-2">
          {highThroughputCount > 0 && (
            <div className="mao-progress-tag-box text-right">
              <span className="mao-progress-tag-label text-(--status-warning)">高吞吐</span>
              <span className="mao-progress-tag-val">{highThroughputCount} 台</span>
            </div>
          )}
          <div className="mao-progress-tag-box text-right">
            <span className="mao-progress-tag-label">离线服务器</span>
            <span className="mao-progress-tag-val">{offlineNodes} 台</span>
          </div>
        </div>
      </div>

      {/* GitHub 风格的规整机架方块矩阵（横竖间距等宽，定高无痕滚动） */}
      <div ref={wrapRef} className="mao-heatmap-wrap">
        <div
          className="mao-heatmap-grid"
          role="grid"
          aria-label="服务器集群机架热力矩阵"
        >
          {/* 已接入的真实节点 */}
          {nodes.map((node, idx) => {
            const { statusClass, badgeText } = resolveNodeThroughputStatus(node);
            const nodeName = nameByUuid?.get(node.uuid) || node.uuid;
            const bootClass = getBootAnimationClass(idx);

            return (
              <button
                key={node.uuid}
                type="button"
                className={`mao-heatmap-cell ${statusClass} ${bootClass}`}
                onClick={() => !isBooting && handleCellClick(node.uuid)}
                onMouseEnter={(e) => !isBooting && handleCellMouseEnter(e, node)}
                onMouseLeave={handleCellMouseLeave}
                aria-label={`${nodeName}: ${badgeText}`}
              />
            );
          })}

          {/* 开启 mockFill 时使用模拟数据填充空位，否则渲染灰色虚线空槽 */}
          {mockFill
            ? mockSlots.map((slot, i) => {
                const idx = nodes.length + i;
                const statusClass =
                  slot.status === "active" ? "is-medium-load" : "is-low-load";
                const badgeText = slot.status === "active" ? "活跃传输" : "空闲待机";
                const bootClass = getBootAnimationClass(idx);

                return (
                  <button
                    key={`mock-slot-${slot.slotNumber}`}
                    type="button"
                    className={`mao-heatmap-cell ${statusClass} is-mock-cell ${bootClass}`}
                    onMouseEnter={(e) => !isBooting && handleMockSlotMouseEnter(e, slot)}
                    onMouseLeave={handleCellMouseLeave}
                    aria-label={`机架模拟槽位 #${slot.slotNumber}: ${badgeText}`}
                  />
                );
              })
            : Array.from({ length: emptySlotsCount }, (_, i) => {
                const idx = nodes.length + i;
                const slotNumber = nodes.length + i + 1;
                const bootClass = getBootAnimationClass(idx);

                return (
                  <div
                    key={`empty-slot-${i}`}
                    className={`mao-heatmap-cell is-empty-slot ${bootClass}`}
                    onMouseEnter={(e) => !isBooting && handleEmptySlotMouseEnter(e, slotNumber)}
                    onMouseLeave={handleCellMouseLeave}
                    aria-label={`机架空槽 #${slotNumber}`}
                  />
                );
              })}
        </div>

        {/* 悬停浮层 Tooltip */}
        {hoverInfo && !isBooting && (
          <div
            className={`mao-heatmap-tooltip is-${hoverInfo.placement}`}
            style={{
              left: `${hoverInfo.x}px`,
              top: `${hoverInfo.y}px`,
            }}
          >
            {hoverInfo.isMock && hoverInfo.mockSlot ? (
              <>
                <div className="mao-tooltip-header">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                      模拟机位
                    </span>
                    <span className="mao-tooltip-name">{hoverInfo.name}</span>
                  </div>
                  <span
                    className={`mao-tooltip-status ${
                      hoverInfo.mockSlot.status === "active" ? "is-active" : "is-idle"
                    }`}
                  >
                    {hoverInfo.mockSlot.status === "active" ? "活跃传输" : "空闲待机"}
                  </span>
                </div>

                <div className="mao-tooltip-stats">
                  <div className="mao-tooltip-stat-item">
                    <span className="label">CPU</span>
                    <span className="val">{hoverInfo.mockSlot.cpuPct}%</span>
                  </div>
                  <div className="mao-tooltip-stat-item">
                    <span className="label">内存</span>
                    <span className="val">{hoverInfo.mockSlot.ramPct}%</span>
                  </div>
                  <div className="mao-tooltip-stat-item">
                    <span className="label">实时带宽</span>
                    <span className="val">
                      ↑ {formatByteRateLabel(hoverInfo.mockSlot.netUp)} · ↓{" "}
                      {formatByteRateLabel(hoverInfo.mockSlot.netDown)}
                    </span>
                  </div>
                </div>
                <div className="mao-tooltip-tip text-(--text-tertiary)">
                  <span>模拟数据填充展示 · 待接入实际服务器</span>
                </div>
              </>
            ) : hoverInfo.isEmpty ? (
              <div className="mao-tooltip-empty-content">
                <span className="font-semibold">{hoverInfo.name}</span>
                <span className="text-[10px] text-(--text-muted) block mt-0.5">
                  空置机位 · 待接入服务器
                </span>
              </div>
            ) : (
              <>
                <div className="mao-tooltip-header">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {hoverInfo.node && <Flag region={hoverInfo.node.region} size={13} />}
                    <span className="mao-tooltip-name">{hoverInfo.name}</span>
                  </div>
                  {hoverInfo.node &&
                    (() => {
                      const info = resolveNodeThroughputStatus(hoverInfo.node);
                      return (
                        <span className={`mao-tooltip-status ${info.badgeClass}`}>
                          {info.badgeText}
                        </span>
                      );
                    })()}
                </div>

                {hoverInfo.node?.online ? (
                  <div className="mao-tooltip-stats">
                    <div className="mao-tooltip-stat-item">
                      <span className="label">CPU</span>
                      <span className="val">{(hoverInfo.node.cpuPct ?? 0).toFixed(0)}%</span>
                    </div>
                    <div className="mao-tooltip-stat-item">
                      <span className="label">内存</span>
                      <span className="val">
                        {hoverInfo.node.ramTotal > 0
                          ? `${((hoverInfo.node.ramUsed / hoverInfo.node.ramTotal) * 100).toFixed(0)}%`
                          : "0%"}
                      </span>
                    </div>
                    <div className="mao-tooltip-stat-item">
                      <span className="label">实时带宽</span>
                      <span className="val">
                        ↑ {formatByteRateLabel(hoverInfo.node.netUp)} · ↓{" "}
                        {formatByteRateLabel(hoverInfo.node.netDown)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mao-tooltip-offline-hint">
                    此服务器已失联，请及时排查处理。
                  </div>
                )}
                <div className="mao-tooltip-tip">
                  <span>点击方块直达节点卡片</span>
                  <span aria-hidden="true">↗</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 底部信息与微型图例 */}
      <div className="mao-progress-section-footer">
        <div className="flex items-center gap-2">
          <span>在线 {onlineNodes} 台</span>
          <div className="mao-legend-colors" aria-hidden="true">
            <span className="mao-legend-text">空闲</span>
            <span
              className="mao-legend-box is-low-load"
              title={colorTheme === "eva" ? "初号机紫 (< 500 KB/s)" : "空闲待机 (< 500 KB/s)"}
            />
            <span
              className="mao-legend-box is-medium-load"
              title={
                colorTheme === "eva"
                  ? "荧光激活绿 (500 KB/s ~ 5 MB/s)"
                  : "活跃传输 (500 KB/s ~ 5 MB/s)"
              }
            />
            <span
              className="mao-legend-box is-high-load"
              title={colorTheme === "eva" ? "装甲警告橙 (≥ 5 MB/s)" : "高吞吐 (≥ 5 MB/s)"}
            />
            <span className="mao-legend-text">高吞吐</span>
          </div>
        </div>
        <span>总计 {totalNodes} 台 · 机架 {totalSlots} 槽</span>
      </div>
    </div>
  );
}
