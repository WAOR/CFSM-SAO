# CFSM-Theme-SAO

<p align="center">
  <strong>SAO 克制的探针监控主题</strong>
</p>

<p align="center">
  <a href="https://github.com/WAOR/CFSM-SAO/releases"><img src="https://img.shields.io/github/v/release/WAOR/CFSM-SAO?color=orange&label=Release" alt="Release"></a>
  <a href="https://github.com/WAOR/CFSM-SAO/actions/workflows/build-theme.yml"><img src="https://img.shields.io/github/actions/workflow/status/WAOR/CFSM-SAO/build-theme.yml?branch=main&label=CI%2FCD" alt="Build Status"></a>
  <a href="https://github.com/WAOR/CFSM-SAO/tree/dist"><img src="https://img.shields.io/badge/branch-dist-blue" alt="Dist Branch"></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

> 💡 **相关版本**：如果您使用的是 Komari 探针服务端，请前往查看对应的 Komari 版本主题：[Komari-Theme-SAO](https://github.com/WAOR/Komari-Theme-SAO)。

---

## ⚡ 快速安装

在 **CF-Server-Monitor** 的管理后台「系统设置」→「主题管理」中添加并启用本主题：

### 方式一：追踪最新稳定版（推荐）
在主题地址栏直接填入 `dist` 分支：
```text
https://github.com/WAOR/CFSM-SAO/tree/dist
```

### 方式二：锁定特定构建版本（生产稳定）
若希望锁定在某个经过验证的构建产物，可直接指定 40 位 Git Commit SHA：
```text
https://github.com/WAOR/CFSM-SAO/tree/<40位dist分支CommitSHA>
```

---

## ✨ 特性与设计亮点

### 🛡️ 安全防御与隐私保护
- **无特征指纹防扫**：去除了页脚与 HTML 中暴露的探针程序版本与元数据，降低被扫描器识别为靶标的风险。
- **价格与资产隐私受控**：
  - **严格访客防御**：未开启「向访客公开价格与资产」时，卡片续费价格标签与资产总览默认向未登录访客彻底隐藏（资产脱敏显示为 `**`）。
  - **管理员快捷开关**：已登录管理员可通过导航栏快捷眼睛按钮一键临时展开/隐藏敏感价格，方便截图与日常分享。

### 💎 极简立体仪表盘美学
- **毛玻璃导航与流光入场**：高质感磨砂玻璃材质，搭配随一天时段自动变化的智能问候语与呼吸流光动效。
- **全方位集群状态大盘**：
  - **双栏总览仪表盘**：集成全站速率、总流量、在线率指示格、临期提醒、资产总值及平滑吞吐波形图。
  - **自由交互资产浮球**：支持全屏幕任意拖拽吸附、点击展开/折叠，并与后台资产开关智能联动。
- **多种卡片与布局形态**：
  - 支持 **标准大卡片**、**紧凑小卡片（Compact）**、**极简微卡片（Mini）** 与 **列表表格视图（List）**，可按喜好随时切换。

### 🎨 深度定制视觉系统
- **护眼与纯黑模式**：
  - **浅色模式**：采用低刺激、抗眩光的分层护眼浅灰底色与立体浮岛卡片。
  - **深色模式**：采用中性纯粹碳黑调色，暗光环境下深邃沉浸。
- **Radix UI Colors 全量调色**：完整对齐 Radix 官方全套 30 种色彩体系，浅色与深色专属对比度调校。
- **背景与亚克力透明度调节**：支持自定义静态壁纸、透明度滑块，以及内置/自定义动态视频背景。

### 📊 细致运维与监控体验
- **多层级 OS 图标与国旗库**：内置主流 Linux 发行版、Windows、BSD 的高清矢量图标与全球地区旗帜，断网或无代理环境下依然完整渲染。
- **今日流量与穿透悬浮**：支持卡片即时查看今日进出流量与额度用量，无需频繁点进详情。
- **7 天临期预警**：shadcn/ui 风格半透 HoverCard，悬停即开即停，服务器续费状态一目了然。

---

## 💻 本地开发与调试

本主题支持在无需后端接口的情况下，使用内置 Mock 数据进行离线完整开发与交互调试：

```bash
# 1. 克隆代码仓库
git clone https://github.com/WAOR/CFSM-SAO.git
cd CFSM-SAO

# 2. 安装依赖
npm install

# 3. 启动本地开发服务（Mock 数据模式）
npm run dev

# 浏览器访问：http://localhost:5173/?mock=1
```

### 常用命令
- `npm run build`：执行类型检查与生产环境打包（产物输出至 `dist/`）。
- `npm run typecheck`：执行 TypeScript 严格类型检查。
- `npm run lint`：执行 ESLint 代码规范扫描。
- `npm test`：运行全部单元测试（基于 Vitest）。

---

## 🔄 CI/CD 自动化部署

仓库配置了 GitHub Actions 持续集成工作流 [`.github/workflows/build-theme.yml`](.github/workflows/build-theme.yml)：
- 每当向 `main` 分支推送代码时，CI 会自动运行类型检查、代码风格扫描、单元测试以及严格的产物结构校验。
- 校验通过后，自动打包并将合规的 `index.html` 与 `assets/` 发布到 **`dist`** 分支，无需手动打包或推送产物。

---

## 💖 致谢与项目渊源

本项目汲取了开源社区探针美学设计灵感，特别感谢以下优秀项目与作者：
- **[volcano-1025/CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus)**：CFSM 版本的 LuminaPlus 主题。
- **[stqfdyr/komari-theme-Lumina](https://github.com/stqfdyr/komari-theme-Lumina)**：开源了优雅的初代 Lumina 主题。
- **[shanyang242/Komari-Theme-LuminaPlus](https://github.com/shanyang242/Komari-Theme-LuminaPlus)**：丰富的功能扩展与架构设计。
- **[Montia37/komari-theme-purcarte](https://github.com/Montia37/komari-theme-purcarte)**：动态背景视频设计思路与素材参考。
- **[CF-Server-Monitor](https://github.com/CF-Server-Monitor)**：强大的探针监控系统生态。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。
