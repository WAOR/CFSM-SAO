import { useState, useRef, useMemo } from "react";
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
}

interface HoverState {
  node?: HomeNodeSummary;
  name: string;
  x: number;
  y: number;
  placement: "top" | "bottom";
  isEmpty?: boolean;
  slotIndex?: number;
}

// 恢复经典 20 列饱满大方格：单块尺寸约 20px，在独占版面下高度舒展，极具 GitHub 风格
const GRID_COLUMNS = 20;
// 默认铺满 5 行标准机架矩阵（即 100 槽），确保在节点少时也能用精致虚线槽位完整撑起状态卡片，
// 与实时网络吞吐双折线图卡片高度严格齐平对齐，避免上下大面积空旷留白与切换时跳高。
const MIN_RACK_ROWS = 5;

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
}: ClusterHeatmapProps) {
  const [hoverInfo, setHoverInfo] = useState<HoverState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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
      emptySlotsCount: total - nodes.length,
    };
  }, [nodes.length]);

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
    // 若方块处于前两行（靠顶端），则将浮层放置在方块正下方，否则放置在方块上方
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
          {nodes.map((node) => {
            const { statusClass, badgeText } = resolveNodeThroughputStatus(node);
            const nodeName = nameByUuid?.get(node.uuid) || node.uuid;

            return (
              <button
                key={node.uuid}
                type="button"
                className={`mao-heatmap-cell ${statusClass}`}
                onClick={() => handleCellClick(node.uuid)}
                onMouseEnter={(e) => handleCellMouseEnter(e, node)}
                onMouseLeave={handleCellMouseLeave}
                aria-label={`${nodeName}: ${badgeText}`}
              />
            );
          })}

          {/* 灰色空置机位槽：彻底铺满整行网格，保证矩形规整对称 */}
          {Array.from({ length: emptySlotsCount }, (_, i) => {
            const slotNumber = nodes.length + i + 1;
            return (
              <div
                key={`empty-slot-${i}`}
                className="mao-heatmap-cell is-empty-slot"
                onMouseEnter={(e) => handleEmptySlotMouseEnter(e, slotNumber)}
                onMouseLeave={handleCellMouseLeave}
                aria-label={`机架空槽 #${slotNumber}`}
              />
            );
          })}
        </div>

        {/* 悬停浮层 Tooltip */}
        {hoverInfo && (
          <div
            className={`mao-heatmap-tooltip is-${hoverInfo.placement}`}
            style={{
              left: `${hoverInfo.x}px`,
              top: `${hoverInfo.y}px`,
            }}
          >
            {hoverInfo.isEmpty ? (
              <div className="mao-tooltip-empty-content">
                <span className="font-semibold">{hoverInfo.name}</span>
                <span className="text-[10px] text-(--text-muted) block mt-0.5">空置机位 · 待接入服务器</span>
              </div>
            ) : (
              <>
                <div className="mao-tooltip-header">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {hoverInfo.node && <Flag region={hoverInfo.node.region} size={13} />}
                    <span className="mao-tooltip-name">
                      {hoverInfo.name}
                    </span>
                  </div>
                  {hoverInfo.node && (() => {
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
              title={colorTheme === "eva" ? "荧光激活绿 (500 KB/s ~ 5 MB/s)" : "活跃传输 (500 KB/s ~ 5 MB/s)"}
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
