// src/services/a2a/agent.ts
import type { AgentCard, AgentInterface } from "./types";

/** Card laden, optional mit Authorization */
export async function fetchAgentCard(cardUrl: string, auth?: string): Promise<AgentCard> {
  const res = await fetch(cardUrl, {
    headers: auth ? { Authorization: auth } : undefined,
  });
  if (!res.ok) throw new Error(`Card fetch failed ${res.status}`);
  return (await res.json()) as AgentCard;
}

/** Aus einer REST-Base-URL die Card-URL ableiten */
export function deriveCardUrlFromBase(baseUrl: string): string {
  const u = new URL(baseUrl);
  return `${u.origin}/.well-known/agent-card.json`;
}

export function isRestCapable(card: AgentCard): boolean {
  if (card.preferredTransport === "HTTP+JSON") return true;
  return !!card.additionalInterfaces?.some((i) => i.transport === "HTTP+JSON");
}

export function allInterfaces(card: AgentCard): AgentInterface[] {
  const main: AgentInterface = { url: card.url, transport: card.preferredTransport || "JSONRPC" };
  const extra = card.additionalInterfaces ?? [];
  const seen = new Set<string>();
  return [main, ...extra].filter((i) => {
    const key = `${i.transport}|${i.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function restInterface(card: AgentCard): AgentInterface | null {
  return allInterfaces(card).find((i) => i.transport === "HTTP+JSON") || null;
}

export function summarizeCard(card: AgentCard) {
  return {
    name: card.name,
    version: card.version,
    preferredTransport: card.preferredTransport || "JSONRPC",
    interfaces: allInterfaces(card),
    capabilities: card.capabilities ?? {},
    defaultInputModes: card.defaultInputModes ?? [],
    defaultOutputModes: card.defaultOutputModes ?? [],
    skills: card.skills ?? [],
    securitySchemes: card.securitySchemes ?? {},
    provider: card.provider,
    documentationUrl: card.documentationUrl,
  };
}
