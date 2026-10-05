import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Trash2, Sparkles } from "lucide-react";
import {
  GRID_COLUMNS,
  TOTAL_PIXELS,
  PATTERN_PRESETS,
  DEFAULT_PATTERN,
  getPatternPixelSet,
} from "@/utils/matrixPatterns";

interface MatrixPatternEditorProps {
  value: number[] | null | undefined;
  onChange: (pattern: number[] | null) => void;
  colorTheme?: "default" | "eva";
}

export function MatrixPatternEditor({
  value,
  onChange,
  colorTheme = "default",
}: MatrixPatternEditorProps) {
  // 当前点亮像素的集合
  const [pixels, setPixels] = useState<Set<number>>(() => getPatternPixelSet(value));

  // 鼠标拖拽绘制状态
  const isMouseDownRef = useRef(false);
  const drawModeRef = useRef<"add" | "remove">("add");
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // 动画预览状态
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewCol, setPreviewCol] = useState(-1);
  const [previewPhase, setPreviewPhase] = useState<"idle" | "scan" | "hold">("idle");
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 当外部 value 发生实质变化（例如重置或从配置载入）时同步本地集合
  useEffect(() => {
    setPixels(getPatternPixelSet(value));
  }, [value]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
    };
  }, []);

  // 提交更新到外部
  const commitChange = useCallback(
    (newSet: Set<number>) => {
      // 检查是否与默认 SAO 完全一致，一致则存 null 节省体积
      const defaultSet = new Set(DEFAULT_PATTERN);
      const isDefault =
        newSet.size === defaultSet.size &&
        Array.from(newSet).every((idx) => defaultSet.has(idx));

      if (isDefault) {
        onChange(null);
      } else {
        onChange(Array.from(newSet).sort((a, b) => a - b));
      }
    },
    [onChange],
  );

  // 开始绘制（按下）
  const handleCellDown = (index: number) => {
    if (isPreviewing) return;
    isMouseDownRef.current = true;
    const isCurrentlyLit = pixels.has(index);
    const mode = isCurrentlyLit ? "remove" : "add";
    drawModeRef.current = mode;

    setPixels((prev) => {
      const next = new Set(prev);
      if (mode === "add") {
        next.add(index);
      } else {
        next.delete(index);
      }
      commitChange(next);
      return next;
    });
  };

  // 拖拽划过其他格子
  const handleCellEnter = (index: number) => {
    if (!isMouseDownRef.current || isPreviewing) return;
    setPixels((prev) => {
      const mode = drawModeRef.current;
      const next = new Set(prev);
      if (mode === "add") {
        next.add(index);
      } else {
        next.delete(index);
      }
      commitChange(next);
      return next;
    });
  };

  // 全局监听鼠标释放
  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDownRef.current = false;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // 移动端触摸滑动绘制支持
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMouseDownRef.current || isPreviewing) return;
    const touch = e.touches[0];
    if (!touch) return;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    const cellIdxStr = target.getAttribute("data-pixel-index");
    if (cellIdxStr !== null) {
      const idx = parseInt(cellIdxStr, 10);
      if (!isNaN(idx) && idx >= 0 && idx < TOTAL_PIXELS) {
        handleCellEnter(idx);
      }
    }
  };

  // 应用预设图案
  const applyPreset = (presetIndices: number[]) => {
    if (isPreviewing) return;
    const newSet = new Set(presetIndices);
    setPixels(newSet);
    commitChange(newSet);
  };

  // 清空画布
  const handleClear = () => {
    if (isPreviewing) return;
    const newSet = new Set<number>();
    setPixels(newSet);
    commitChange(newSet);
  };


  // 播放开屏动画预览
  const startPreview = () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    setPreviewPhase("scan");
    setPreviewCol(-1);

    let current = 0;
    const interval = setInterval(() => {
      setPreviewCol(current);
      current++;
      if (current > GRID_COLUMNS) {
        clearInterval(interval);
        setPreviewPhase("hold");
        // 呼吸 1.5 秒后恢复编辑态
        setTimeout(() => {
          setPreviewPhase("idle");
          setIsPreviewing(false);
          setPreviewCol(-1);
        }, 1500);
      }
    }, 28);
    previewTimerRef.current = interval;
  };

  // 判断当前像素在预览模式下的展示样式
  const getCellPreviewClass = (index: number) => {
    if (!isPreviewing || previewPhase === "idle") {
      return pixels.has(index) ? "is-lit" : "";
    }
    const col = index % GRID_COLUMNS;
    const isLit = pixels.has(index);

    if (previewPhase === "scan") {
      if (col === previewCol) return "is-scan-beam";
      if (col < previewCol) return isLit ? "is-lit" : "";
      return "is-unlit";
    }
    if (previewPhase === "hold") {
      return isLit ? "is-lit is-preview-pulse" : "";
    }
    return "";
  };

  return (
    <div className="mao-pattern-editor">
      {/* 顶部工具栏与状态 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-(--text-secondary) flex items-center gap-1">
            <Sparkles size={13} className="text-(--accent-500)" />
            绘制画布 (20 × 5)
          </span>
          <span className="text-[10px] text-(--text-muted) px-1.5 py-0.5 rounded bg-(--bg-card) border border-(--hairline)">
            已点亮 {pixels.size} / {TOTAL_PIXELS} 格
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={startPreview}
            disabled={isPreviewing}
            className="mao-pattern-action-btn is-play"
            title="播放开屏扫描与呼吸预览"
          >
            <Play size={12} className={isPreviewing ? "animate-pulse" : ""} />
            <span>{isPreviewing ? "预览中..." : "动效预览"}</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isPreviewing || pixels.size === 0}
            className="mao-pattern-action-btn"
            title="清空当前画布"
          >
            <Trash2 size={12} />
            <span>清空</span>
          </button>

        </div>
      </div>

      {/* 20 × 5 微型像素网格画布 */}
      <div
        ref={gridContainerRef}
        className={`mao-pattern-canvas ${colorTheme === "eva" ? "is-eva" : ""}`}
        onMouseLeave={() => {
          isMouseDownRef.current = false;
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          isMouseDownRef.current = false;
        }}
        role="grid"
        aria-label="点阵开屏图案绘制画布"
      >
        {Array.from({ length: TOTAL_PIXELS }, (_, idx) => {
          const previewClass = getCellPreviewClass(idx);
          const isLit = pixels.has(idx);

          return (
            <div
              key={idx}
              data-pixel-index={idx}
              className={`mao-pattern-cell ${previewClass}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleCellDown(idx);
              }}
              onMouseEnter={() => handleCellEnter(idx)}
              onTouchStart={(e) => {
                e.preventDefault();
                handleCellDown(idx);
              }}
              aria-label={`第 ${Math.floor(idx / GRID_COLUMNS) + 1} 行，第 ${(idx % GRID_COLUMNS) + 1} 列: ${
                isLit ? "已点亮" : "未点亮"
              }`}
            />
          );
        })}
      </div>

      {/* 底部常用预设快捷选用 */}
      <div className="mt-2.5 pt-2 border-t border-(--hairline)/60 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-(--text-muted) mr-0.5">常用预设:</span>
        {Object.values(PATTERN_PRESETS).map((preset) => {
          const isCurrent =
            pixels.size === preset.indices.length &&
            preset.indices.every((idx) => pixels.has(idx));

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.indices)}
              disabled={isPreviewing}
              className={`mao-preset-chip ${isCurrent ? "is-active" : ""}`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
