import { defineConfig, loadEnv } from "vite";

// Dev-only: serve api/ai.js at /api/ai so AI twins and residents work with `npm run dev`
// when ANTHROPIC_API_KEY is set in .env. In production the host (e.g. Vercel) runs api/ai.js.
function devApi(env) {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/ai", async (req, res) => {
        if (!env.ANTHROPIC_API_KEY) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "No ANTHROPIC_API_KEY set; using offline replies." }));
          return;
        }
        process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
        let raw = "";
        for await (const chunk of req) raw += chunk;
        req.body = raw ? JSON.parse(raw) : {};
        const shim = {
          status(code) { res.statusCode = code; return shim; },
          json(obj) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); },
        };
        const { default: handler } = await server.ssrLoadModule("/api/ai.js");
        await handler(req, shim);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [devApi(env)],
    build: {
      target: "esnext", // allows top-level await
      chunkSizeWarningLimit: 1200,
    },
  };
});
