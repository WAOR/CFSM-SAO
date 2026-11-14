import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatMicroVisual } from "../StatMicroVisual";
import type { OverviewCardId } from "@/types/cfsm";

describe("CFSM StatMicroVisual", () => {
  const allCards: OverviewCardId[] = [
    "connections",
    "cpu",
    "ram",
    "disk",
    "uptime",
    "asset",
    "nodes",
    "bandwidth",
    "swap",
    "process",
    "cores",
    "loss",
  ];

  it.each(allCards)("renders micro-visual cleanly for card '%s'", (metric) => {
    const html = renderToStaticMarkup(
      <StatMicroVisual
        metric={metric}
        ramPct={50}
        diskPct={40}
        avgCpu={25}
        totalTcpConn={100}
        totalUdpConn={20}
        onlinePct={100}
        onlineNodes={5}
        offlineNodes={0}
        totalNodes={5}
        swapPct={10}
        recentRebootSeconds={10800}
      />
    );
    expect(html).toContain("<svg");
  });

  it("renders non-circular ECG vital telemetry trace for 'uptime' card without any dots", () => {
    const html = renderToStaticMarkup(
      <StatMicroVisual metric="uptime" recentRebootSeconds={7200} />
    );
    expect(html).toContain("mao-micro-uptime-ecg");
    expect(html).toContain("mao-ecg-grid");
    expect(html).toContain("mao-ecg-trace");
    expect(html).not.toContain("<circle");
  });

  it("renders static aesthetic states for cpu and connections when microVisualMode is static", () => {
    // 1. CPU 静态美化状态：峰值柱高 44（保留清晰顶部虚影）
    const cpuStatic = renderToStaticMarkup(<StatMicroVisual metric="cpu" avgCpu={2} microVisualMode="static" />);
    expect(cpuStatic).toContain('height="44"');

    // 2. 活跃连接静态美化状态：使用 0.78 饱满外环弧度，告别低连接空轨虚影
    const connStatic = renderToStaticMarkup(<StatMicroVisual metric="connections" totalTcpConn={10} totalUdpConn={2} microVisualMode="static" />);
    expect(connStatic).toContain('mao-conn-fill-tcp');
    expect(connStatic).toContain('mao-conn-fill-udp');
    // cOuter ~257.61, 257.61 * 0.78 ~200.935
    expect(connStatic).toMatch(/stroke-dasharray="200\./);
  });

  it("renders nodes cluster keepalive telemetry micro visual", () => {
    const html = renderToStaticMarkup(
      <StatMicroVisual
        metric="nodes"
        onlinePct={83.3}
        onlineNodes={5}
        offlineNodes={1}
        totalNodes={6}
      />
    );
    expect(html).toContain("<svg");
    expect(html).toContain("mao-micro-nodes-ecg");
    expect(html).toContain("mao-ecg-grid");
    expect(html).toContain("mao-ecg-trace");
    expect(html).toContain("has-offline");
  });

  it("renders agonal single weak pulse for all-offline (0% online) nodes", () => {
    const html = renderToStaticMarkup(
      <StatMicroVisual
        metric="nodes"
        onlinePct={0}
        onlineNodes={0}
        offlineNodes={6}
        totalNodes={6}
      />
    );
    expect(html).toContain("has-all-offline");
    expect(html).toContain("has-offline");
    expect(html).toContain("M 2 32 L 24 32");
  });

  it("renders process task cascade windows and prompt", () => {
    const html = renderToStaticMarkup(<StatMicroVisual metric="process" />);
    expect(html).toContain("<svg");
    expect(html).toContain("mao-micro-proc-cascade");
    expect(html).toContain("mao-proc-window");
    expect(html).toContain("mao-proc-prompt-arrow");
    expect(html).toContain("mao-proc-task-bar");
  });

  it("renders loss trigram with CT, CU, CM and data-tier attributes without cap lines", () => {
    const html = renderToStaticMarkup(
      <StatMicroVisual
        metric="loss"
        ctLoss={0.8}
        cuLoss={6.5}
        cmLoss={28.4}
      />
    );
    expect(html).toContain("mao-micro-trigram");
    expect(html).toContain("CT");
    expect(html).toContain("CU");
    expect(html).toContain("CM");
    expect(html).toContain('data-tier="good"');
    expect(html).toContain('data-tier="warning"');
    expect(html).toContain('data-tier="error"');
    expect(html).not.toContain("mao-trigram-cap");
  });
});
