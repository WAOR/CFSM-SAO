import { useEffect, useState } from "react";
import { GitBranch, ExternalLink } from "lucide-react";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import pkg from "../../../package.json" with { type: "json" };

const CFSM_VERSION_STORAGE_KEY = "cfsmtheme:version";

export function SiteFooter() {
  const { data: publicConfig } = usePublicConfig();
  const rawVersion = publicConfig?.version?.trim();

  // 缓存与持久化 CFSM 版本号，避免刷新时因网络异步返回导致胶囊宽度从短变长闪烁
  const [cachedVersion, setCachedVersion] = useState<string>(() => {
    if (typeof localStorage === "undefined") return "";
    try {
      return localStorage.getItem(CFSM_VERSION_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (rawVersion) {
      setCachedVersion(rawVersion);
      try {
        localStorage.setItem(CFSM_VERSION_STORAGE_KEY, rawVersion);
      } catch {}
    }
  }, [rawVersion]);

  const activeVersion = rawVersion || cachedVersion;
  const cfsmVersion = activeVersion ? `v${activeVersion}` : "";
  const themeVersion = pkg.version ? `v${pkg.version}` : "v1.1.2";

  return (
    <footer className="home-site-footer site-footer" aria-label="站点与主题版本信息">
      <div className="home-footer-capsule">
        {/* 左侧呼吸点与 CFSM 探针标识及版本 */}
        <div className="home-footer-brand">
          <span className="home-footer-pulse" aria-hidden="true" />
          <a
            href="https://github.com/huilang-me/CF-Server-Monitor/"
            target="_blank"
            rel="noopener noreferrer"
            className="home-footer-title-link"
            title="CF-Server-Monitor"
          >
            CFSM
          </a>
          {cfsmVersion && (
            <span className="home-footer-pill" title={`CFSM ${cfsmVersion}`}>
              {cfsmVersion}
            </span>
          )}
        </div>

        <span className="home-footer-divider" aria-hidden="true" />

        {/* 主题标识 */}
        <span className="home-footer-title">SAO</span>

        <span className="home-footer-divider" aria-hidden="true" />

        {/* 主题版本芯片 */}
        <span className="home-footer-version" title={`主题版本 ${themeVersion}`}>
          <GitBranch size={10} className="home-footer-branch-icon" aria-hidden="true" />
          <span>{themeVersion}</span>
        </span>

        <span className="home-footer-divider" aria-hidden="true" />

        {/* GitHub 交互链接 */}
        <a
          href="https://github.com/WAOR/CFSM-SAO"
          target="_blank"
          rel="noopener noreferrer"
          className="home-footer-github"
          title="前往 GitHub 仓库"
        >
          <svg
            className="home-footer-github-icon"
            viewBox="0 0 24 24"
            width="11"
            height="11"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span>GitHub</span>
          <ExternalLink size={9} className="home-footer-external-icon" aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
