/**
 * Edge middleware — proxies every request to graph.facebook.com
 * Env: META_PROXY_SECRET (same as Contabo META_GRAPH_PROXY_SECRET)
 */
export default async function middleware(request) {
  const secret = String(process.env.META_PROXY_SECRET || "").trim();
  if (secret) {
    const provided = String(request.headers.get("x-meta-proxy-secret") || "").trim();
    if (provided !== secret) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          hint: "Use header X-Meta-Proxy-Secret (browser access is blocked).",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, "https://graph.facebook.com");

  const headers = new Headers();
  headers.set("Host", "graph.facebook.com");
  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);

  try {
    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
    });

    const resHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) resHeaders.set("Content-Type", ct);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Upstream graph.facebook.com unreachable",
        message: err?.message || "fetch failed",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const config = {
  matcher: "/:path*",
};
