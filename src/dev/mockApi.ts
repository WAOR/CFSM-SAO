/**
 * 开发用的假后端：拦截 fetch，按 CF-Server-Monitor 的公开 API 形状返回数据。
 * 通过 `?mock=1` 启用，只在 dev 构建里被引入。
 *
 * WebSocket 不做模拟——连接失败后 store 会自动降级为轮询，正好覆盖降级路径。
 */

interface MockServer {
  id: string;
  name: string;
  server_group: string;
  region: string;
  os: string;
  arch: string;
  cpu_info: string;
  cpu_cores: number;
  kernel_version: string;
  /** MiB */
  ram_total: number;
  swap_total: number;
  disk_total: number;
  price: string;
  currency: string;
  billing_cycle: string;
  auto_renewal: string;
  expire_date: string;
  /** GB */
  traffic_limit: string;
  traffic_calc_type: string;
  reset_day: number;
  tags: string;
  sort_order: number;
  is_hidden: "0" | "1";
  gpu?: string;
  offline?: boolean;
  highLoad?: boolean;
}

function daysFromNow(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

const BASE_SERVERS: MockServer[] = [
  // 1. 日本东京
  {
    id: "tokyo-edge-01",
    name: "Tokyo Edge 01",
    server_group: "生产",
    region: "JP",
    os: "Debian 12",
    arch: "x86_64",
    cpu_info: "AMD EPYC 7B13",
    cpu_cores: 4,
    kernel_version: "6.1.0-18-amd64",
    ram_total: 8 * 1024,
    swap_total: 2 * 1024,
    disk_total: 160 * 1024,
    price: "48.00",
    currency: "¥",
    billing_cycle: "month",
    auto_renewal: "1",
    expire_date: daysFromNow(24),
    traffic_limit: "4096",
    traffic_calc_type: "total",
    reset_day: 1,
    tags: "边缘,高带宽",
    sort_order: 10,
    is_hidden: "0",
  },
  // 2. 中国香港
  {
    id: "hk-api-02",
    name: "HK API Premium",
    server_group: "生产",
    region: "HK",
    os: "Ubuntu 22.04",
    arch: "x86_64",
    cpu_info: "Intel Xeon Platinum 8375C",
    cpu_cores: 8,
    kernel_version: "5.15.0-91-generic",
    ram_total: 16 * 1024,
    swap_total: 0,
    disk_total: 320 * 1024,
    price: "128.00",
    currency: "¥",
    billing_cycle: "year",
    auto_renewal: "0",
    expire_date: daysFromNow(6),
    traffic_limit: "1024",
    traffic_calc_type: "max",
    reset_day: 15,
    tags: "API,CN2",
    sort_order: 20,
    is_hidden: "0",
    gpu: '[{"id":"0","name":"NVIDIA RTX 3060","info":42.5}]',
  },
  // 3. 德国法兰克福 (构建机高负载)
  {
    id: "fra-build-03",
    name: "Frankfurt Build",
    server_group: "构建",
    region: "DE",
    os: "Alpine Linux 3.19",
    arch: "aarch64",
    cpu_info: "Ampere Altra",
    cpu_cores: 4,
    kernel_version: "6.6.4-0-lts",
    ram_total: 8 * 1024,
    swap_total: 1024,
    disk_total: 80 * 1024,
    price: "0",
    currency: "$",
    billing_cycle: "month",
    auto_renewal: "0",
    expire_date: "",
    traffic_limit: "",
    traffic_calc_type: "total",
    reset_day: 1,
    tags: "CI,编译中",
    sort_order: 30,
    is_hidden: "0",
    highLoad: true,
  },
  // 4. 新加坡备份 (已离线)
  {
    id: "sg-backup-04",
    name: "Singapore Backup",
    server_group: "备份",
    region: "SG",
    os: "OpenWrt 23.05",
    arch: "x86_64",
    cpu_info: "Intel N100",
    cpu_cores: 4,
    kernel_version: "5.15.137",
    ram_total: 8 * 1024,
    swap_total: 0,
    disk_total: 2048 * 1024,
    price: "19.90",
    currency: "$",
    billing_cycle: "quarter",
    auto_renewal: "1",
    expire_date: daysFromNow(-3),
    traffic_limit: "512",
    traffic_calc_type: "dl",
    reset_day: 5,
    tags: "冷备,离线",
    sort_order: 40,
    is_hidden: "0",
    offline: true,
  },
  // 5. 美国洛杉矶
  {
    id: "us-la-vmiss-05",
    name: "VMISS US.LA.TRI",
    server_group: "生产",
    region: "US",
    os: "Debian 11",
    arch: "x86_64",
    cpu_info: "Intel Xeon E5-2696 v4",
    cpu_cores: 2,
    kernel_version: "5.10.0-28-amd64",
    ram_total: 2 * 1024,
    swap_total: 1024,
    disk_total: 40 * 1024,
    price: "5.00",
    currency: "$",
    billing_cycle: "month",
    auto_renewal: "1",
    expire_date: daysFromNow(18),
    traffic_limit: "1000",
    traffic_calc_type: "total",
    reset_day: 1,
    tags: "BGP,三网直连",
    sort_order: 50,
    is_hidden: "0",
  },
  // 6. 澳大利亚悉尼（与 Komari/Monitor 统一前 6 台基准节点为 6 个不同地区）
  {
    id: "au-syd-edge-06",
    name: "Sydney AU-Edge",
    server_group: "生产",
    region: "AU",
    os: "Debian 12",
    arch: "x86_64",
    cpu_info: "Intel Xeon Platinum",
    cpu_cores: 2,
    kernel_version: "6.1.0-18-amd64",
    ram_total: 4 * 1024,
    swap_total: 0,
    disk_total: 60 * 1024,
    price: "12.00",
    currency: "$",
    billing_cycle: "month",
    auto_renewal: "1",
    expire_date: daysFromNow(25),
    traffic_limit: "2000",
    traffic_calc_type: "total",
    reset_day: 1,
    tags: "大洋洲节点",
    sort_order: 60,
    is_hidden: "0",
  },
  // 7. 香港 CN2
  {
    id: "hk-shandun-07",
    name: "shandun hk Standard",
    server_group: "生产",
    region: "HK",
    os: "Debian 12",
    arch: "x86_64",
    cpu_info: "Intel Xeon Platinum",
    cpu_cores: 2,
    kernel_version: "6.1.0-21-amd64",
    ram_total: 4 * 1024,
    swap_total: 0,
    disk_total: 50 * 1024,
    price: "68.00",
    currency: "¥",
    billing_cycle: "month",
    auto_renewal: "1",
    expire_date: daysFromNow(12),
    traffic_limit: "800",
    traffic_calc_type: "total",
    reset_day: 8,
    tags: "CN2-GIA",
    sort_order: 70,
    is_hidden: "0",
  },
  // 8. 美国西雅图
  {
    id: "us-sea-kirino-08",
    name: "Kirino US-West",
    server_group: "生产",
    region: "US",
    os: "Arch Linux",
    arch: "x86_64",
    cpu_info: "AMD Ryzen 9 7950X",
    cpu_cores: 8,
    kernel_version: "6.9.1-arch1-1",
    ram_total: 32 * 1024,
    swap_total: 4096,
    disk_total: 1024 * 1024,
    price: "85.00",
    currency: "$",
    billing_cycle: "month",
    auto_renewal: "1",
    expire_date: daysFromNow(22),
    traffic_limit: "10000",
    traffic_calc_type: "total",
    reset_day: 1,
    tags: "高性能,计算",
    sort_order: 80,
    is_hidden: "0",
  },
  // 9. 日本大阪
  {
    id: "jp-osaka-09",
    name: "Osaka BGP Direct",
    server_group: "生产",
    region: "JP",
    os: "Debian 12",
    arch: "x86_64",
    cpu_info: "Intel Xeon Gold 6133",
    cpu_cores: 2,
    kernel_version: "6.1.0-18-amd64",
    ram_total: 4 * 1024,
    swap_total: 1024,
    disk_total: 80 * 1024,
    price: "32.00",
    currency: "¥",
    billing_cycle: "month",
    auto_renewal: "1",
    expire_date: daysFromNow(15),
    traffic_limit: "1500",
    traffic_calc_type: "total",
    reset_day: 1,
    tags: "大阪BGP",
    sort_order: 90,
    is_hidden: "0",
  },
  // 10. 英国伦敦
  {
    id: "gb-lon-edge-10",
    name: "London Edge Gateway",
    server_group: "边缘",
    region: "GB",
    os: "Ubuntu 22.04",
    arch: "x86_64",
    cpu_info: "AMD EPYC 7763",
    cpu_cores: 2,
    kernel_version: "5.15.0-89-generic",
    ram_total: 4 * 1024,
    swap_total: 0,
    disk_total: 60 * 1024,
    price: "6.50",
    currency: "£",
    billing_cycle: "month",
    auto_renewal: "1",
    expire_date: daysFromNow(29),
    traffic_limit: "2000",
    traffic_calc_type: "total",
    reset_day: 1,
    tags: "欧洲边缘",
    sort_order: 100,
    is_hidden: "0",
  },
];

function getMockServers(): MockServer[] {
  if (typeof window === "undefined") return BASE_SERVERS;
  const params = new URLSearchParams(window.location.search);
  const targetCount = Number(params.get("nodes"));
  if (!targetCount) {
    return BASE_SERVERS;
  }
  if (targetCount < BASE_SERVERS.length) {
    return BASE_SERVERS.slice(0, targetCount);
  }

  // 如果用户指定了像 ?mock=1&nodes=60 或 100，自动扩充复制
  const result: MockServer[] = [...BASE_SERVERS];
  let i = BASE_SERVERS.length;
  while (result.length < targetCount) {
    const template = BASE_SERVERS[i % BASE_SERVERS.length]!;
    result.push({
      ...template,
      id: `${template.id}-sub-${Math.floor(i / BASE_SERVERS.length) + 1}`,
      name: `${template.name} #${Math.floor(i / BASE_SERVERS.length) + 1}`,
      sort_order: template.sort_order + i * 5,
      // 保持合理的离线和高载比例
      offline: i % 15 === 0,
      highLoad: i % 9 === 0,
    });
    i++;
  }
  return result;
}

const SERVERS = getMockServers();

function wave(seed: number, period: number, amplitude: number, offset: number) {
  return offset + Math.sin((Date.now() / period) * (1 + seed * 0.17)) * amplitude;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 新版后端在 /api/servers 里直接给的一小时探测窗口：30 个点、每 2 分钟一个。 */
function buildLatencyWindow(index: number, offline: boolean, basePing = 36) {
  const now = Date.now();
  const slot = 2 * 60 * 1000;
  const ping = [];
  const loss = [];
  for (let i = 29; i >= 0; i--) {
    const ts = now - i * slot;
    const phase = i / 4 + index;
    const jitter = Math.sin(phase) * 4;
    ping.push({
      ts,
      ct: offline ? null : Math.round(clamp(basePing + jitter, 1, 400)),
      cu: offline ? null : Math.round(clamp(basePing * 1.08 + jitter * 1.2 + 2, 1, 400)),
      cm: offline ? null : Math.round(clamp(basePing * 1.15 + jitter * 1.4 + 4, 1, 400)),
      bd: offline ? null : Math.round(clamp(basePing * 0.96 + jitter * 0.8, 1, 400)),
      // 后四条线路：node_3/4 恒 null，模拟后台没配探测目标的槽位。
      node_1: offline ? null : Math.round(clamp(basePing * 0.8 + jitter, 1, 400)),
      node_2: offline ? null : Math.round(clamp(basePing * 1.25 + jitter * 1.5, 1, 400)),
      node_3: null,
      node_4: null,
    });
    // 针对每台服务器的地域与序号，生成真实、各有差异的丢包数据：
    // - index 2 (Frankfurt Build): 特意作为高丢包典型机（移动丢包 ~38%，电信 ~18%，联通 ~26%，微图立柱瞬间冲顶变红变长）
    // - index 0 (Tokyo Edge 01): 极低丢包优质机 (~0.5%，微图立柱平缓贴底)
    // - index 1 (HK API Premium): 零丢包精品机 (~0%)
    // - 其他服务器梯队分布，勾选不同机器时微图立柱高低起伏极其显著！
    let ct = 0;
    let cu = 0;
    let cm = 0;

    if (index === 2) {
      // Frankfurt Build：高丢包机器（方便对比测试）
      ct = (i % 3 === 0) ? 18 : 0;
      cu = (i % 2 === 0) ? 26 : 0;
      cm = (i % 2 === 0 || i % 3 === 0) ? 38 : 0;
    } else if (index === 4) {
      // VMISS US.LA.TRI: 中等丢包机器 (~8% ~12%)
      ct = (i % 8 === 0) ? 6 : 0;
      cu = (i % 5 === 0) ? 10 : 0;
      cm = (i % 4 === 0) ? 14 : 0;
    } else if (index === 0) {
      // Tokyo Edge 01: 极低丢包优质机
      ct = (i === 15) ? 1 : 0;
      cu = (i === 8) ? 2 : 0;
      cm = (i === 20) ? 3 : 0;
    } else if (index === 1) {
      // HK API Premium: 零丢包精品机
      ct = 0;
      cu = 0;
      cm = 0;
    } else {
      // 其余机器：平缓低丢包 (~1% ~ 4%)
      ct = ((i + index) % 15 === 0) ? 2 : 0;
      cu = ((i + index * 2) % 12 === 0) ? 3 : 0;
      cm = ((i + index * 3) % 10 === 0) ? 5 : 0;
    }

    loss.push({
      ts,
      ct: offline ? null : ct,
      cu: offline ? null : cu,
      cm: offline ? null : cm,
      bd: offline ? null : 0,
      node_1: offline ? null : 0,
      node_2: offline ? null : (i % 11 === 0 ? 3 : 0),
      node_3: null,
      node_4: null,
    });
  }
  return { ping, loss };
}

function buildServerPayload(server: MockServer, index: number) {
  const now = Date.now();
  const offline = server.offline === true;
  const isHigh = !offline && server.highLoad === true;
  const cpu = offline
    ? 0
    : isHigh
      ? clamp(wave(index, 14_000, 8, 86), 80, 96)
      : clamp(wave(index, 24_000, 18, 28), 3, 62);
  const ramUsed = offline
    ? 0
    : Math.round(
        server.ram_total *
          (isHigh ? clamp(wave(index, 20_000, 0.05, 0.88), 0.82, 0.94) : clamp(wave(index, 41_000, 0.18, 0.52), 0.05, 0.75)),
      );
  const diskUsed = Math.round(server.disk_total * (0.3 + (index % 5) * 0.12));

  const region = (server.region || "").toUpperCase();
  let basePing = 36;
  if (region === "HK" || region === "TW" || region === "SG" || region === "JP") {
    basePing = 28 + (index % 4) * 14; // 28, 42, 56 (≤60ms 亮荧光绿), 70 (≤100ms 纯正翠绿)
  } else if (region === "US" || region === "CA") {
    basePing = 135 + (index % 3) * 8; // 135, 143, 151 (≤160ms 亮机甲紫)
  } else if (region === "DE" || region === "GB" || region === "FR" || region === "CH") {
    basePing = 175 + (index % 3) * 7; // 175, 182, 189 (≤200ms 深机甲紫)
  } else if (region === "AU" || region === "KR") {
    basePing = 215 + (index % 3) * 16; // 215, 231, 247 (>200ms EVA 暴走血红)
  } else {
    basePing = 52 + (index % 5) * 36;
  }

  return {
    id: server.id,
    name: server.name,
    server_group: server.server_group,
    tags: server.tags,
    price: server.price,
    billing_cycle: server.billing_cycle,
    auto_renewal: server.auto_renewal,
    currency: server.currency,
    expire_date: server.expire_date,
    traffic_limit: server.traffic_limit,
    traffic_calc_type: server.traffic_calc_type,
    reset_day: server.reset_day,
    report_interval: 60,
    is_hidden: server.is_hidden,
    sort_order: server.sort_order,

    cpu,
    load_avg: offline ? "0.00 0.00 0.00" : `${(cpu / 100 * server.cpu_cores).toFixed(2)} ${(cpu / 130 * server.cpu_cores).toFixed(2)} ${(cpu / 160 * server.cpu_cores).toFixed(2)}`,
    net_in_speed: offline ? 0 : Math.round(clamp(wave(index, 9_000, 4_000_000, 5_200_000), 0, 2e8)),
    net_out_speed: offline ? 0 : Math.round(clamp(wave(index + 3, 11_000, 2_400_000, 3_100_000), 0, 2e8)),
    net_rx: 4.2e12 + index * 3.1e11,
    net_tx: 2.6e12 + index * 1.7e11,
    net_rx_monthly: 3.1e11 + index * 8.4e10,
    net_tx_monthly: 1.9e11 + index * 5.2e10,
    processes: offline ? 0 : 120 + index * 37,
    tcp_conn: offline ? 0 : 48 + index * 19,
    udp_conn: offline ? 0 : 6 + index * 3,

    ping_ct: offline ? null : Math.round(clamp(basePing + wave(index, 33_000, 4, 0), 1, 400)),
    ping_cu: offline ? null : Math.round(clamp(basePing * 1.08 + wave(index + 1, 29_000, 6, 2), 1, 400)),
    ping_cm: offline ? null : Math.round(clamp(basePing * 1.15 + wave(index + 2, 37_000, 7, 4), 1, 400)),
    ping_bd: offline ? null : Math.round(clamp(basePing * 0.96 + wave(index + 4, 31_000, 4, 0), 1, 400)),
    // 后端 2.8.5 Beta4 起多出来的四条自定义线路。node_3/4 故意留空，
    // 模拟「后台没给这两个槽位配探测目标」——主题应当显示「无样本」而不是画一条 0ms 的线。
    ping_node_1: offline ? null : Math.round(clamp(wave(index + 5, 27_000, 14, 46), 1, 400)),
    ping_node_2: offline ? null : Math.round(clamp(wave(index + 6, 41_000, 30, 96), 1, 400)),
    ping_node_3: null,
    ping_node_4: null,
    loss_ct: offline ? null : 0,
    loss_cu: offline ? null : index === 1 ? 4 : 0,
    loss_cm: offline ? null : 0,
    loss_bd: offline ? null : 0,
    loss_node_1: offline ? null : 0,
    loss_node_2: offline ? null : index === 2 ? 6 : 0,
    loss_node_3: null,
    loss_node_4: null,

    ram_total: server.ram_total,
    ram_used: ramUsed,
    swap_total: server.swap_total,
    swap_used: offline ? 0 : Math.round(server.swap_total * 0.12),
    disk_total: server.disk_total,
    disk_used: diskUsed,
    disk: offline
      ? undefined
      : {
          read_bps: Math.round(clamp(wave(index, 13_000, 3e6, 4e6), 0, 5e8)),
          write_bps: Math.round(clamp(wave(index + 2, 17_000, 1e6, 2e6), 0, 5e8)),
          read_iops: 42 + index * 11,
          write_iops: 18 + index * 7,
          await_ms: 1.2 + index * 0.3,
          util: clamp(wave(index, 21_000, 12, 18), 0, 100),
        },

    cpu_cores: server.cpu_cores,
    cpu_info: server.cpu_info,
    gpu_info: server.gpu ?? "",
    arch: server.arch,
    os: server.os,
    kernel_version: server.kernel_version,
    region: server.region,
    ip_v4: "1",
    ip_v6: index % 2 === 0 ? "1" : "0",
    boot_time: String(now - (index + 1) * 86_400_000 * 9),
    agent_version: "1.3.3",
    last_updated: offline ? now - 40 * 60_000 : now,
    timestamp: offline ? now - 40 * 60_000 : now,
    ...buildLatencyWindow(index, offline, basePing),
  };
}

function buildHistory(serverId: string, hours: number) {
  const index = Math.max(0, SERVERS.findIndex((server) => server.id === serverId));
  const server = SERVERS[index];
  if (!server) return [];

  const points = 120;
  const now = Date.now();
  const stepMs = (hours * 3_600_000) / points;
  const rows = [];
  for (let i = points; i >= 0; i--) {
    const timestamp = now - i * stepMs;
    const phase = (i / points) * Math.PI * 4 + index;
    rows.push({
      timestamp,
      cpu: clamp(34 + Math.sin(phase) * 26, 0, 100),
      gpu_info: server.gpu ?? "",
      ram_total: server.ram_total,
      ram_used: Math.round(server.ram_total * clamp(0.52 + Math.sin(phase / 2) * 0.18, 0.05, 0.95)),
      swap_total: server.swap_total,
      swap_used: Math.round(server.swap_total * 0.12),
      disk_total: server.disk_total,
      disk_used: Math.round(server.disk_total * (0.3 + index * 0.12)),
      disk: {
        read_bps: Math.round(clamp(4e6 + Math.sin(phase) * 3e6, 0, 5e8)),
        write_bps: Math.round(clamp(2e6 + Math.cos(phase) * 1e6, 0, 5e8)),
        read_iops: 42,
        write_iops: 18,
        await_ms: 1.4,
        util: clamp(18 + Math.sin(phase) * 12, 0, 100),
      },
      processes: 120 + index * 37,
      net_in_speed: Math.round(clamp(5.2e6 + Math.sin(phase) * 4e6, 0, 2e8)),
      net_out_speed: Math.round(clamp(3.1e6 + Math.cos(phase) * 2.4e6, 0, 2e8)),
      tcp_conn: 48 + index * 19,
      udp_conn: 6 + index * 3,
      ping_ct: Math.round(clamp(38 + Math.sin(phase) * 12, 1, 400)),
      ping_cu: Math.round(clamp(52 + Math.sin(phase + 1) * 18, 1, 400)),
      ping_cm: Math.round(clamp(74 + Math.sin(phase + 2) * 26, 1, 400)),
      ping_bd: Math.round(clamp(21 + Math.sin(phase + 3) * 9, 1, 400)),
      ping_node_1: Math.round(clamp(46 + Math.sin(phase + 4) * 14, 1, 400)),
      ping_node_2: Math.round(clamp(96 + Math.sin(phase + 5) * 30, 1, 400)),
      ping_node_3: false,
      ping_node_4: null,
      loss_ct: 0,
      loss_cu: i % 17 === 0 ? 20 : 0,
      loss_cm: 0,
      loss_bd: 0,
      loss_node_1: 0,
      loss_node_2: i % 23 === 0 ? 8 : 0,
      loss_node_3: false,
      loss_node_4: null,
      load_avg: "0.42 0.38 0.31",
      kernel_version: server.kernel_version,
    });
  }
  return rows;
}

const MOCK_THEME_OPTIONS_STORAGE_KEY = "cfsm:dev_mock_theme_options";

function readPersistedMockThemeOptions(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(MOCK_THEME_OPTIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writePersistedMockThemeOptions(options: Record<string, unknown>): void {
  try {
    window.localStorage.setItem(MOCK_THEME_OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {}
}

let mockThemeOptions: Record<string, unknown> = readPersistedMockThemeOptions();

const MOCK_TURNSTILE_MODE = new URLSearchParams(window.location.search).get("turnstile");
const MOCK_TURNSTILE = MOCK_TURNSTILE_MODE === "1" || MOCK_TURNSTILE_MODE === "block";
const MOCK_TURNSTILE_SITE_KEY =
  MOCK_TURNSTILE_MODE === "block" ? "2x00000000000000000000AB" : "1x00000000000000000000AA";
const MOCK_TURNSTILE_CREDENTIAL = "mock-turnstile-verified";

export function installDevMockApi() {
  const searchParams = new URLSearchParams(window.location.search);
  const adminParam = searchParams.get("admin");
  if (adminParam === "1" || (searchParams.get("mock") === "1" && adminParam !== "0")) {
    try {
      window.localStorage.setItem("jwt_token", "mock-admin-token");
      if (!window.localStorage.getItem("cfsm_admin_username")) {
        window.localStorage.setItem("cfsm_admin_username", "Admin");
      }
    } catch {}
  } else if (adminParam === "0") {
    try {
      window.localStorage.removeItem("jwt_token");
    } catch {}
  }
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      window.location.origin,
    );

    const json = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    if (
      url.hostname === "api.frankfurter.dev" ||
      url.hostname === "open.er-api.com" ||
      url.hostname === "api.exchangerate-api.com"
    ) {
      if (url.hostname === "api.frankfurter.dev") {
        return json([
          { base: "USD", quote: "CNY", rate: 7.18 },
          { base: "USD", quote: "EUR", rate: 0.86 },
          { base: "USD", quote: "JPY", rate: 146.4 },
        ]);
      }
      return json({
        result: "success",
        rates: {
          USD: 1,
          CNY: 7.18,
          EUR: 0.86,
          JPY: 146.4,
          CAD: 1.38,
          HKD: 7.82,
          GBP: 0.76,
        },
      });
    }

    const log = ((window as unknown as { __mockApiLog?: string[] }).__mockApiLog ??= []);
    const requestHeaders = new Headers(init?.headers);
    const turnstilePassed =
      requestHeaders.get("X-Turnstile-Verified") === MOCK_TURNSTILE_CREDENTIAL ||
      Boolean(requestHeaders.get("X-Turnstile-Token"));
    if (
      MOCK_TURNSTILE &&
      !turnstilePassed &&
      url.pathname.startsWith("/api/") &&
      url.pathname !== "/api/config"
    ) {
      log.push(`403 ${url.pathname}`);
      return new Response(JSON.stringify({ error: "Turnstile verification failed", code: 403 }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/api/")) log.push(`200 ${url.pathname}`);

    if (url.pathname === "/api/theme_options" && init?.method?.toUpperCase() === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as { theme_options?: unknown };
      const next = body.theme_options;
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        return new Response(JSON.stringify({ error: "invalidThemeOptionsFormat", code: 400 }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      mockThemeOptions = { ...readPersistedMockThemeOptions(), ...(next as Record<string, unknown>) };
      writePersistedMockThemeOptions(mockThemeOptions);
      return json({ success: true, theme_options: mockThemeOptions, message: "updateSuccess" });
    }

    if (url.pathname === "/api/config") {
      mockThemeOptions = readPersistedMockThemeOptions();
      const searchParams = new URLSearchParams(window.location.search);
      const adminParam = searchParams.get("admin");
      if (adminParam === "1") {
        window.localStorage.setItem("jwt_token", "mock-jwt-token");
      } else if (adminParam === "0") {
        window.localStorage.removeItem("jwt_token");
      }
      const loggedIn = Boolean(window.localStorage.getItem("jwt_token"));
      const isMultiPing = searchParams.get("multiPing") === "1";
      const urlTemplate = searchParams.get("template");
      const urlViewMode = searchParams.get("viewMode");
      const urlAppearance = searchParams.get("appearance");
      const mergedThemeOptions = {
        serverCardTemplate: "layered",
        overviewCardVisualMode: "visual",
        overviewMicroVisualMode: "dynamic",
        ...mockThemeOptions,
        ...(urlTemplate === "layered" || urlTemplate === "classic" ? { serverCardTemplate: urlTemplate } : {}),
        ...(urlViewMode ? { desktopNodeViewMode: urlViewMode, mobileNodeViewMode: urlViewMode } : {}),
        ...(urlAppearance ? { appearance: urlAppearance } : {}),
        ...(isMultiPing ? { enableHomepageMultiPing: true, homepageMultiPingTaskIds: [1, 2, 3] } : {}),
      };
      return json({
        version: "2.8.5 Beta5",
        ...(loggedIn ? { last_workers_version: "2.8.6", last_agent_version: "1.0.3" } : {}),
        is_public: true,
        authorization: loggedIn,
        preferred_theme: urlAppearance || "dark",
        frontend_ws_timeout_minutes: 0,
        turnstile_enabled: MOCK_TURNSTILE,
        turnstile_login_enabled: false,
        turnstile_site_key: MOCK_TURNSTILE ? MOCK_TURNSTILE_SITE_KEY : "",
        site_title: "CFSM-SAO",
        display_mode: "bar",
        theme_options: mergedThemeOptions,
        verified: MOCK_TURNSTILE && turnstilePassed,
        turnstile_verified: MOCK_TURNSTILE && turnstilePassed ? MOCK_TURNSTILE_CREDENTIAL : null,
        long_history_points: 120,
        custom_ct_name: "CT 电信",
        custom_cu_name: "CU 联通",
        custom_cm_name: "",
        custom_bd_name: "BGP",
        node_1_name: "东京",
        node_2_name: "法兰克福",
        node_3_name: "",
        latency_window: { points: 20, hours: 2 },
      });
    }

    if (url.pathname === "/api/servers") {
      const servers = SERVERS.map((server, index) => buildServerPayload(server, index));
      const online = servers.filter((server) => Date.now() - server.last_updated < 300_000);
      return json({
        servers,
        latestReportUpdates: [],
        stats: {
          total: servers.length,
          online: online.length,
          offline: servers.length - online.length,
          globalSpeedIn: online.reduce((sum, server) => sum + server.net_in_speed, 0),
          globalSpeedOut: online.reduce((sum, server) => sum + server.net_out_speed, 0),
          globalNetRx: servers.reduce((sum, server) => sum + server.net_rx, 0),
          globalNetTx: servers.reduce((sum, server) => sum + server.net_tx, 0),
        },
        regionStats: servers.reduce<Record<string, number>>((acc, server) => {
          acc[server.region] = (acc[server.region] ?? 0) + 1;
          return acc;
        }, {}),
        sysConfig: {
          show_price: true,
          show_expire: true,
          show_tf: true,
          show_time: true,
          display_mode: "bar",
        },
      });
    }

    if (url.pathname === "/api/server") {
      const id = url.searchParams.get("id") ?? "";
      const index = SERVERS.findIndex((server) => server.id === id);
      if (index < 0) {
        return new Response(JSON.stringify({ error: "Server not found", code: 404 }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return json({
        ...buildServerPayload(SERVERS[index]!, index),
        latestReportUpdates: [],
        sysConfig: { long_history_points: 120 },
      });
    }

    if (url.pathname === "/api/history/all") {
      const id = url.searchParams.get("id") ?? "";
      const hours = Number.parseFloat(url.searchParams.get("hours") ?? "24") || 24;
      return json(buildHistory(id, hours));
    }

    return nativeFetch(input, init);
  };

  console.info(`[CFSM-SAO] dev mock API enabled (${SERVERS.length} servers)`);
}
