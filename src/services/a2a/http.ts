export type AgentConn = { baseUrl: string; headers?: Record<string, string> };

const join = (base: string, path: string) =>
  `${base.replace(/\/$/, "")}${path}`;

export async function reqJSON<T>(
  conn: AgentConn,
  path: string,
  init?: RequestInit
): Promise<T> {
  const r = await fetch(join(conn.baseUrl, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(conn.headers || {}),
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${init?.method || "GET"} ${path} ${r.status}`);
  return (await r.json()) as T;
}

export async function reqSSE(
  conn: AgentConn,
  path: string,
  init: RequestInit & { onEvent: (data: any) => void }
) {
  const r = await fetch(join(conn.baseUrl, path), {
    ...init,
    headers: { ...(conn.headers || {}), ...(init.headers || {}) },
  });
  if (!r.ok || !r.body) throw new Error(`SSE ${path} ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const parse = () => {
    const blocks = buf.split("\n\n");
    for (let i = 0; i < blocks.length - 1; i++) {
      const line = blocks[i].split("\n").find((l) => l.startsWith("data:"));
      if (line) {
        const json = line.slice(5).trim();
        try {
          init.onEvent(JSON.parse(json));
        } catch {}
      }
    }
    buf = blocks[blocks.length - 1];
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    parse();
  }
}
