const http = require("http");
const { Counter, Histogram, Registry, collectDefaultMetrics } = require("prom-client");

const TARGET_URL = process.env.TARGET_URL || "http://api-gateway:3000/api/campaigns";
const TARGET_RPS = Number(process.env.TARGET_RPS || "1000");
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || "60");
const METRICS_PORT = Number(process.env.METRICS_PORT || "9101");
const METRICS_PATH = process.env.METRICS_PATH || "/metrics";

const register = new Registry();
collectDefaultMetrics({ register });

const requestCounter = new Counter({
  name: "load_tester_requests_total",
  help: "Total HTTP requests made by the load tester",
  labelNames: ["status"],
  registers: [register]
});

const durationHistogram = new Histogram({
  name: "load_tester_request_duration_seconds",
  help: "HTTP request duration for load tester",
  labelNames: ["status"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register]
});

async function fireOnce() {
  const end = durationHistogram.startTimer();
  let statusLabel = "error";
  try {
    const res = await fetch(TARGET_URL);
    statusLabel = res.ok ? "ok" : String(res.status);
  } catch (err) {
    statusLabel = "error";
  } finally {
    requestCounter.inc({ status: statusLabel });
    end({ status: statusLabel });
  }
}

function startLoad() {
  const intervalMs = 100; // fire every 100ms
  const perTick = Math.max(1, Math.round((TARGET_RPS * intervalMs) / 1000));
  const start = Date.now();

  console.log(
    `Starting load test: target=${TARGET_URL}, rps=${TARGET_RPS}, duration=${DURATION_SECONDS}s`
  );

  const timer = setInterval(() => {
    const elapsedSeconds = (Date.now() - start) / 1000;
    if (elapsedSeconds >= DURATION_SECONDS) {
      clearInterval(timer);
      console.log("Load test finished.");
      return;
    }
    for (let i = 0; i < perTick; i += 1) {
      // fire and forget
      void fireOnce();
    }
  }, intervalMs);
}

function startMetricsServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url === METRICS_PATH) {
      try {
        const metrics = await register.metrics();
        res.writeHead(200, {
          "Content-Type": register.contentType
        });
        res.end(metrics);
      } catch (err) {
        res.writeHead(500);
        res.end("Error generating metrics");
      }
      return;
    }

    if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          targetUrl: TARGET_URL,
          targetRps: TARGET_RPS,
          durationSeconds: DURATION_SECONDS
        })
      );
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(METRICS_PORT, () => {
    console.log(
      `Load tester metrics server listening on port ${METRICS_PORT}${METRICS_PATH}`
    );
  });
}

startMetricsServer();
startLoad();


