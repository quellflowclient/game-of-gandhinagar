import { defineConfig, loadEnv } from "vite";

// Dev-only: serve api/ai.js at /api/ai so AI twins and residents work with `npm run dev`
// when ANTHROPIC_API_KEY is set in .env. In production the host (e.g. Vercel) runs api/ai.js.
function devApi(env) {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/turn",async(req,res)=>{
        const {createTurnHandler}=await server.ssrLoadModule("/api/turn.js");
        const shim={setHeader:(...a)=>res.setHeader(...a),status(code){res.statusCode=code;return shim;},json(data){res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));}};
        await createTurnHandler(env)(req,shim);
      });
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

// Dev-only: /admin and every /admin/<page> load the admin app (same as vercel.json).
function adminRoutes() {
  const middleware = (req,res,next) => {
    const [path,query] = (req.url || "").split("?");
    if(path==="/admin.html"){res.statusCode=302;res.setHeader("Location","/admin"+(query?"?"+query:""));return res.end();}
    if(path==="/admin"||(path.startsWith("/admin/")&&!path.includes(".")))req.url="/admin/index.html"+(query?"?"+query:"");
    next();
  };
  return {name:"admin-routes",configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [devApi(env), adminRoutes()],
    build: {
      target: "esnext", // allows top-level await
      chunkSizeWarningLimit: 1200,
      // Separate admin page: players never download the admin code.
      rollupOptions: { input: { main: "index.html", admin: "admin/index.html" } },
    },
  };
});
