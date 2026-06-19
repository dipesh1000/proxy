/**
 * Forwards HTTPS to graph.facebook.com so Contabo (unstable Meta egress) can use
 * graph-proxy.ordertaptap.com as META_GRAPH_PROXY_URL.
 *
 * Set env on Vercel: META_PROXY_SECRET = long random string
 * Set on Contabo .env: META_GRAPH_PROXY_URL + META_GRAPH_PROXY_SECRET (same value)
 */
const META_ORIGIN = "https://graph.facebook.com";

export default async function handler(req, res) {
  const secret = process.env.META_PROXY_SECRET?.trim();
  if (secret) {
    const provided =
      req.headers["x-meta-proxy-secret"] ||
      req.headers["X-Meta-Proxy-Secret"];
    if (provided !== secret) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const pathParts = req.query.path;
  const segments = Array.isArray(pathParts) ? pathParts : pathParts ? [pathParts] : [];
  const path = segments.length ? `/${segments.join("/")}` : "/";
  const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = `${META_ORIGIN}${path}${qs}`;

  const headers = {};
  const auth = req.headers.authorization || req.headers.Authorization;
  if (auth) headers.Authorization = auth;
  headers.Host = "graph.facebook.com";

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      signal: AbortSignal.timeout(25000),
    });

    const body = await upstream.arrayBuffer();
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    return res.send(Buffer.from(body));
  } catch (err) {
    console.error("[meta-graph-proxy]", target, err?.message);
    return res.status(502).json({
      error: "Upstream graph.facebook.com unreachable",
      message: err?.message || "fetch failed",
    });
  }
}
