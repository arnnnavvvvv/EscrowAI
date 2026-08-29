// HTTP entry point for the sample webhook service — routes provider webhooks and exposes the observation endpoints EscrowAI uses.

import { createServer } from "node:http";
import { handleStripe, handleRazorpay } from "./handlers.js";
import { allEffects, hydrateFromDisk } from "./effects.js";
import { snapshot } from "./ledger.js";

const port = Number(process.env.PORT ?? 4000);

// Count of upcoming webhook deliveries to reject with 500 before processing — used to model provider retries.
let failNext = 0;

hydrateFromDisk();

// Read and JSON-parse a request body.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// Write a JSON response.
function json(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text)
  });
  res.end(text);
}

const server = createServer(async (req, res) => {
  const { method, url } = req;

  if (method === "GET" && url === "/__health") {
    return json(res, 200, { ok: true });
  }
  if (method === "GET" && url === "/__effects") {
    return json(res, 200, { effects: allEffects() });
  }
  if (method === "GET" && url === "/__state") {
    return json(res, 200, snapshot());
  }
  if (method === "POST" && url === "/__control/fail-next") {
    const body = await readBody(req).catch(() => ({}));
    failNext = Number(body.count ?? 1);
    return json(res, 200, { failNext });
  }

  if (method === "POST" && (url === "/webhooks/stripe" || url === "/webhooks/razorpay")) {
    if (failNext > 0) {
      failNext -= 1;
      return json(res, 500, { error: "injected failure" });
    }

    let event;
    try {
      event = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid JSON" });
    }

    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)])
    );

    const result =
      url === "/webhooks/stripe"
        ? handleStripe(event, headers)
        : handleRazorpay(event, headers);

    return json(res, result.status, result.body);
  }

  return json(res, 404, { error: "not found" });
});

server.listen(port, () => {
  console.log(`sample-target listening on :${port}`);
});
