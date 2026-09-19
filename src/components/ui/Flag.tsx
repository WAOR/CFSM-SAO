import { useState } from "react";
import { hostAssetUrl } from "@/services/cfsm/config";
import { getDisplayRegionCode } from "@/utils/geo";

interface FlagProps {
  region?: string | null;
  size?: number;
}

export function Flag({ region, size = 14 }: FlagProps) {
  const value = region?.trim() ?? "";
  const [failStage, setFailStage] = useState(0);

  if (!value) {
    return (
      <span
        aria-hidden
        className="inline-block rounded-[3px] shrink-0"
        style={{
          width: size + 8,
          height: size,
          background: "var(--border-subtle)",
        }}
      />
    );
  }

  const flagCode = getDisplayRegionCode(value);
  const alt = `地区旗帜: ${flagCode}`;

  if (failStage >= 2) {
    return (
      <span
        role="img"
        aria-label={alt}
        className="inline-block rounded-[3px] shrink-0"
        title={alt}
        style={{
          width: size + 8,
          height: size,
          background: "var(--border-subtle)",
        }}
      />
    );
  }

  // 首选用后端官方提供的 /flags/xx.svg，失败时回退到主题 assets/flags/XX.svg
  const src =
    failStage === 0
      ? hostAssetUrl(`/flags/${flagCode.toLowerCase()}.svg`)
      : `/assets/flags/${flagCode}.svg`;

  return (
    <span
      className="inline-flex items-center shrink-0"
      style={{
        width: size + 8,
        height: size,
        lineHeight: 0,
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
        onError={() => setFailStage((prev) => prev + 1)}
      />
    </span>
  );
}
