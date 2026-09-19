import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleDollarSign } from "lucide-react";

const STORAGE_KEY = "cfsm-sao:cost-ball-pos:v1";
const BALL_SIZE = 36;
const PADDING = 12;

interface BallPosition {
  x: number;
  y: number;
}

function clampPosition(x: number, y: number): BallPosition {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(PADDING, window.innerWidth - BALL_SIZE - PADDING);
  const maxY = Math.max(PADDING, window.innerHeight - BALL_SIZE - PADDING);
  return {
    x: Math.min(Math.max(PADDING, x), maxX),
    y: Math.min(Math.max(PADDING, y), maxY),
  };
}

function getInitialPosition(): BallPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { x: number; y: number };
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return clampPosition(parsed.x, parsed.y);
      }
    }
  } catch {
    // 忽略 localStorage 错误
  }
  return null;
}

export const DraggableCostBall = memo(function DraggableCostBall() {
  const [position, setPosition] = useState<BallPosition | null>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
    pointerId: number | null;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
    pointerId: null,
  });

  // 如果初始没有存储的位置，在挂载时按右上角默认位置初始化
  useEffect(() => {
    if (!position && typeof window !== "undefined") {
      const defaultX = Math.max(PADDING, window.innerWidth - BALL_SIZE - 20);
      const defaultY = 76;
      setPosition(clampPosition(defaultX, defaultY));
    }
  }, [position]);

  // 视口大小改变时保证悬浮球依然在可视范围内
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        return clampPosition(prev.x, prev.y);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
    // 仅响应主按键（鼠标左键或触控）
    if (e.button !== 0) return;

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
      hasMoved: false,
      pointerId: e.pointerId,
    };

    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const { startX, startY, initialX, initialY } = dragRef.current;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!dragRef.current.hasMoved && Math.hypot(deltaX, deltaY) > 4) {
        dragRef.current.hasMoved = true;
      }

      if (dragRef.current.hasMoved) {
        const next = clampPosition(initialX + deltaX, initialY + deltaY);
        setPosition(next);
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      // 保存最终位置到 localStorage
      setPosition((latest) => {
        if (latest && dragRef.current.hasMoved) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
          } catch {
            // 忽略存储失败
          }
        }
        return latest;
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    // 如果拖拽位移超过阈值，阻止触发点击链接跳转
    if (dragRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 41,
    touchAction: "none",
    userSelect: "none",
    cursor: isDragging ? "grabbing" : "grab",
    ...(position
      ? {
          left: `${position.x}px`,
          top: `${position.y}px`,
          right: "auto",
          bottom: "auto",
        }
      : {}),
    ...(isDragging ? { transition: "none", transform: "scale(1.14)" } : {}),
  };

  return (
    <Link
      to="/assets"
      className="cost-summary-ball show"
      aria-label="打开资产统计页（可拖动）"
      title="资产统计（可拖动）"
      style={style}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <span className="cost-summary-ball-icon pointer-events-none" aria-hidden>
        <CircleDollarSign size={16} />
      </span>
    </Link>
  );
});
