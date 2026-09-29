import { usePublicConfig } from "@/hooks/usePublicConfig";
import pkg from "../../../package.json" with { type: "json" };

export function SiteFooter() {
  const { data: publicConfig } = usePublicConfig();
  const cfsmVersion = publicConfig?.version ? `v${publicConfig.version}` : "";
  const themeVersion = pkg.version ? `v${pkg.version}` : "";

  return (
    <footer className="w-full py-6 mt-auto text-center select-none text-[12px] text-(--text-tertiary)">
      <div className="mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
        <span>
          Powered by{" "}
          <a
            href="https://github.com/huilang-me/CF-Server-Monitor/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline transition-colors text-(--text-secondary) hover:text-(--text-primary)"
          >
            CF-Server-Monitor
          </a>
          {cfsmVersion && <span className="ml-1 opacity-70 font-mono text-[11px]">{cfsmVersion}</span>}
        </span>
        <span className="opacity-40" aria-hidden>
          ·
        </span>
        <span>
          Theme{" "}
          <a
            href="https://github.com/WAOR/CFSM-SAO"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline transition-colors text-(--text-secondary) hover:text-(--text-primary)"
          >
            SAO
          </a>
          {themeVersion && <span className="ml-1 opacity-70 font-mono text-[11px]">{themeVersion}</span>}
        </span>
      </div>
    </footer>
  );
}

