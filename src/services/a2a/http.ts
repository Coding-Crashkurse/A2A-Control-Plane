// All browser requests go through the UI server proxy.
// Base path is ALWAYS "/api" (same origin). No direct calls to the agent.

export type AgentConn = { baseUrl: string; headers?: Record<string, string> };

export const PROXY_BASE = "/api";
export const defaultConn: AgentConn = { baseUrl: PROXY_BASE };

const join = (base: string, path: string) =>
  `${base.replace(/\/$/, "")}${path}`;

export async function reqJSON<T>(
  conn: AgentConn = defaultConn,
  path: string,
  init?: RequestInit
): Promise<T> {
  const hasBody = !!init?.body;
  const r = await fetch(join(conn.baseUrl, path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(conn.headers || {}),
      ...(init?.headers || {}),
    },
    credentials: "omit",
  });
  if (!r.ok) throw new Error(`${init?.method || "GET"} ${path} ${r.status}`);
  return (await r.json()) as T;
}

export async function reqSSE(
  conn: AgentConn = defaultConn,
  path: string,
  init: RequestInit & { onEvent: (data: any) => void }
) {
  const hasBody = !!init.body;
  const r = await fetch(join(conn.baseUrl, path), {
    ...init,
    headers: {
      Accept: "text/event-stream",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(conn.headers || {}),
      ...(init.headers || {}),
    },
    credentials: "omit",
  });
  if (!r.ok || !r.body) throw new Error(`SSE ${path} ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  const flush = () => {
    const blocks = buf.split("\n\n");
    for (let i = 0; i < blocks.length - 1; i++) {
      const dataLines = blocks[i]
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (dataLines.length) {
        const payload = dataLines.join("\n");
        try { init.onEvent(JSON.parse(payload)); } catch {}
      }
    }
    buf = blocks[blocks.length - 1];
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    flush();
  }
}
