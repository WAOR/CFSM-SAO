import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NodeGrid } from "@/components/node/NodeGrid";
import { FloatingControls } from "@/components/shell/FloatingControls";
import { useNodeStoreStatus } from "@/hooks/useNode";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { ThemeManage } from "@/pages/ThemeManage";

function HomeDashboard() {
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const themeSettings = useThemeSettings();
  const { hydrated: storeHydrated } = useNodeStoreStatus();
  const homeReady = themeSettings.isReady && storeHydrated;

  useEffect(() => {
    document.body.classList.toggle("is-nav-controls-expanded", controlsExpanded);
    return () => {
      document.body.classList.remove("is-nav-controls-expanded");
    };
  }, [controlsExpanded]);

  return (
    <div
      className={`home-dashboard relative pb-2${controlsExpanded ? " is-controls-expanded" : ""}`}
    >
      {homeReady && <FloatingControls onExpandedChange={setControlsExpanded} />}
      <NodeGrid />
    </div>
  );
}

export function Home() {
  const [searchParams] = useSearchParams();
  const isThemeManageView = searchParams.get("view") === "theme-manage";

  // 主题设置只写本机浏览器，不需要登录态；管理后台入口另行跳转 /admin#/admin。
  if (isThemeManageView) {
    return <ThemeManage />;
  }

  return <HomeDashboard />;
}
