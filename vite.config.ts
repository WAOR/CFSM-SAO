import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import pkg from "./package.json" with { type: "json" };
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * 开发用占位图：旗帜和 OS 图标平时由后端默认皮肤提供，本地没有后端时会整屏碎图。
 * `<img>` 不走 fetch，拦不到，所以放在 dev server 中间件里；不进产物。
 */
function devHostAssets(): Plugin {
  return {
    name: "cfsm-dev-host-assets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (!path.startsWith("/flags/") && !path.startsWith("/os-icons/")) {
          next();
          return;
        }
        const label = (path.split("/").pop() ?? "").replace(/\.\w+$/, "").slice(0, 4);
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24">` +
            `<rect width="32" height="24" rx="3" fill="#5b6472"/>` +
            `<text x="16" y="16" font-size="8" fill="#fff" text-anchor="middle">${label}</text>` +
            `</svg>`,
        );
      });
    },
  };
}

/**
 * 把主题版本写进产物的 `<meta name="theme-version">`。
 */
function themeVersionMeta(version: string): Plugin {
  return {
    name: "cfsm-theme-version",
    transformIndexHtml(html) {
      return html.replace(
        "</head>",
        `  <meta name="theme-version" content="SAO v${version}" />\n  </head>`,
      );
    },
  };
}

/**
 * 把 `.env` 里的 API_BASE 写进 dev server 服务的 `<meta name="apiBase">`。
 */
function devApiBaseMeta(apiBase: string): Plugin {
  const escaped = apiBase
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return {
    name: "cfsm-dev-api-base",
    apply: "serve",
    transformIndexHtml(html) {
      if (!apiBase) return html;
      return html.replace(
        /<meta name="apiBase" content="[^"]*"\s*\/?>/,
        () => `<meta name="apiBase" content="${escaped}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = (env.API_BASE ?? "").trim();

  return {
    plugins: [
      react(),
      tailwindcss(),
      devHostAssets(),
      themeVersionMeta(pkg.version),
      devApiBaseMeta(apiBase),
    ],
    // CF-Server-Monitor 的主题构建产物只能是 index.html + assets/，相对路径引用
    base: "./",
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      target: ["es2022", "chrome111", "safari16.2", "firefox113"],
      assetsDir: "assets",
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalized = id.replace(/\\/g, "/");
            if (!normalized.includes("/node_modules/")) return;

            if (
              /\/node_modules\/(?:react|react-dom|react-router|react-router-dom)\//.test(
                normalized,
              )
            ) {
              return "react";
            }
            if (normalized.includes("/node_modules/@tanstack/react-query/")) {
              return "query";
            }
            if (/\/node_modules\/(?:uplot|uplot-react)\//.test(normalized)) {
              return "charts";
            }
            if (normalized.includes("/node_modules/zod/")) {
              return "validation";
            }
          },
        },
      },
    },
  };
});
