import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import pkg from "./package.json" with { type: "json" };
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * 开发用图标静态代理：
 * 旗帜和 OS 图标平时由后端默认皮肤提供（`/flags/` 和 `/os-icons/`）。
 * 本地开发时优先读取本地主题内置的 `public/assets/flags` 与 `public/assets/os-icons` 真实高清图标；
 * 仅在本地未收录对应图标时，以平滑的无碎图占位 SVG 兜底。仅在 dev server 生效，不进产物。
 */
function devHostAssets(): Plugin {
  return {
    name: "cfsm-dev-host-assets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqPath = (req.url ?? "").split("?")[0] ?? "";
        if (!reqPath.startsWith("/flags/") && !reqPath.startsWith("/os-icons/")) {
          next();
          return;
        }

        const fileName = reqPath.split("/").pop() ?? "";
        const ext = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, ext);

        const candidatePaths: string[] = [];
        if (reqPath.startsWith("/flags/")) {
          candidatePaths.push(
            path.resolve(process.cwd(), "public/assets/flags", `${baseName.toUpperCase()}${ext}`),
            path.resolve(process.cwd(), "public/assets/flags", `${baseName.toLowerCase()}${ext}`),
            path.resolve(process.cwd(), "public/assets/flags", fileName),
          );
        } else if (reqPath.startsWith("/os-icons/")) {
          candidatePaths.push(
            path.resolve(process.cwd(), "public/assets/os-icons", fileName),
            path.resolve(process.cwd(), "public/assets/os-icons", `${baseName.toLowerCase()}${ext}`),
          );
        }

        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            const mimeTypes: Record<string, string> = {
              ".svg": "image/svg+xml",
              ".png": "image/png",
              ".webp": "image/webp",
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".ico": "image/x-icon",
            };
            const contentType = mimeTypes[ext] ?? "application/octet-stream";
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "no-cache");
            fs.createReadStream(candidate).pipe(res);
            return;
          }
        }

        const label = baseName.slice(0, 4);
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
