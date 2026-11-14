import { describe, expect, it } from "vitest";
import {
  calculateCarrierLoss,
  detectCarrier,
  getLossTier,
} from "@/utils/carrierLoss";
import type { HomepagePingLine, PingOverviewItem } from "@/types/cfsm";

describe("detectCarrier", () => {
  it("识别电信各种变体", () => {
    expect(detectCarrier("中国电信 上海")).toBe("ct");
    expect(detectCarrier("ct-beijing")).toBe("ct");
    expect(detectCarrier("CT 广州 189")).toBe("ct");
  });

  it("识别联通各种变体", () => {
    expect(detectCarrier("中国联通 廊坊")).toBe("cu");
    expect(detectCarrier("ChinaUnicom")).toBe("cu");
    expect(detectCarrier("10010 CU")).toBe("cu");
  });

  it("识别移动各种变体", () => {
    expect(detectCarrier("中国移动 广州CMI")).toBe("cm");
    expect(detectCarrier("chinamobile")).toBe("cm");
    expect(detectCarrier("CM BJ")).toBe("cm");
  });

  it("未识别时返回 unknown", () => {
    expect(detectCarrier("海外测试 8.8.8.8")).toBe("unknown");
  });
});

describe("getLossTier", () => {
  it("<=3% 判定为 good", () => {
    expect(getLossTier(0)).toBe("good");
    expect(getLossTier(0.8)).toBe("good");
    expect(getLossTier(3)).toBe("good");
  });

  it("3%~15% 判定为 warning", () => {
    expect(getLossTier(3.1)).toBe("warning");
    expect(getLossTier(6.5)).toBe("warning");
    expect(getLossTier(15)).toBe("warning");
  });

  it(">15% 判定为 error", () => {
    expect(getLossTier(15.1)).toBe("error");
    expect(getLossTier(28.4)).toBe("error");
    expect(getLossTier(100)).toBe("error");
  });
});

describe("calculateCarrierLoss", () => {
  it("当未启用多线模式时返回待机状态", () => {
    const res = calculateCarrierLoss(new Map(), new Map(), undefined, false);
    expect(res.isMultiPingMode).toBe(false);
    expect(res.hasAnyData).toBe(false);
    expect(res.peakLoss).toBeNull();
    expect(res.avgLoss).toBeNull();
    expect(res.ct.loss).toBeNull();
    expect(res.cu.loss).toBeNull();
    expect(res.cm.loss).toBeNull();
  });

  it("当无数据时返回缺省默认结构", () => {
    const res = calculateCarrierLoss(new Map(), new Map());
    expect(res.isMultiPingMode).toBe(true);
    expect(res.hasAnyData).toBe(false);
    expect(res.peakLoss).toBeNull();
    expect(res.avgLoss).toBeNull();
    expect(res.ct.loss).toBeNull();
    expect(res.cu.loss).toBeNull();
    expect(res.cm.loss).toBeNull();
  });

  it("正确聚合三网线路并输出各自均值与总体峰值", () => {
    const multiLines = new Map<string, HomepagePingLine[]>();
    multiLines.set("node-1", [
      {
        taskId: 1,
        taskName: "电信探针",
        lastValue: 20,
        loss: 1.2,
        max: 50,
        samples: [],
        client: "node-1",
        isAssigned: true,
      },
      {
        taskId: 2,
        taskName: "联通探针",
        lastValue: 35,
        loss: 4.8,
        max: 60,
        samples: [],
        client: "node-1",
        isAssigned: true,
      },
      {
        taskId: 3,
        taskName: "移动探针",
        lastValue: 50,
        loss: 12.0,
        max: 80,
        samples: [],
        client: "node-1",
        isAssigned: true,
      },
    ]);
    multiLines.set("node-2", [
      {
        taskId: 1,
        taskName: "CT-2",
        lastValue: 18,
        loss: 0.6,
        max: 40,
        samples: [],
        client: "node-2",
        isAssigned: true,
      },
      {
        taskId: 2,
        taskName: "CU-2",
        lastValue: 40,
        loss: 5.2,
        max: 70,
        samples: [],
        client: "node-2",
        isAssigned: true,
      },
      {
        taskId: 3,
        taskName: "CM-2",
        lastValue: 55,
        loss: 24.0,
        max: 90,
        samples: [],
        client: "node-2",
        isAssigned: true,
      },
    ]);

    const singleItems = new Map<string, PingOverviewItem>();

    const summary = calculateCarrierLoss(multiLines, singleItems);
    expect(summary.hasAnyData).toBe(true);
    expect(summary.ct.loss).toBe(0.9); // (1.2 + 0.6) / 2
    expect(summary.cu.loss).toBe(5.0); // (4.8 + 5.2) / 2
    expect(summary.cm.loss).toBe(18.0); // (12.0 + 24.0) / 2
    expect(summary.peakLoss).toBe(18.0);
  });
});
