import type { AgentCard } from "./types";

/** Configure proxy and optionally return the card. */
export async function configureProxy(params: {
  cardUrl?: string;
  restBase?: string;
  authBearer?: string;
}): Promise<{ restBase: string; configured: boolean; card?: AgentCard }> {
  const res = await fetch("/control/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`config ${res.status}`);
  return (await res.json()) as any;
}

/** Fetch Agent Card via UI server. If auth given, set it first via /control/config. */
export async function fetchAgentCard(cardUrl: string, authBearer?: string): Promise<AgentCard> {
  if (authBearer && authBearer.trim()) {
    const data = await configureProxy({ cardUrl, authBearer });
    if (!data.card) throw new Error("card missing in /control/config response");
    return data.card as AgentCard;
  }
  const r = await fetch(`/control/card?url=${encodeURIComponent(cardUrl)}`);
  if (!r.ok) throw new Error(`card ${r.status}`);
  return (await r.json()) as AgentCard;
}

export function deriveCardUrlFromBase(base: string): string {
  return `${base.replace(/\/$/, "")}/.well-known/agent-card.json`;
}

export function isRestCapable(card: AgentCard): boolean {
  const anyCard: any = card as any;
  const pref = anyCard.preferredTransport ?? anyCard.preferred_transport;
  const url = anyCard.url;
  if (pref === "HTTP+JSON" && url) return true;
  const add = anyCard.additionalInterfaces ?? anyCard.additional_interfaces ?? [];
  return !!add.find((i: any) => i.transport === "HTTP+JSON");
}

/** Minimal summary for UI badges. */
export function summarizeCard(card: AgentCard) {
  const anyCard: any = card as any;
  const capabilities = anyCard.capabilities ?? {};
  const interfaces =
    anyCard.additionalInterfaces ?? anyCard.additional_interfaces ?? [];
  return {
    name: anyCard.name,
    version: anyCard.version,
    preferredTransport: anyCard.preferredTransport ?? anyCard.preferred_transport,
    defaultInputModes: anyCard.defaultInputModes ?? [],
    defaultOutputModes: anyCard.defaultOutputModes ?? [],
    interfaces: interfaces.map((i: any) => ({ transport: i.transport, url: i.url })),
    capabilities: {
      streaming: !!capabilities.streaming,
      pushNotifications: !!(capabilities.pushNotifications ?? capabilities.push_notifications),
      stateTransitionHistory: !!(capabilities.stateTransitionHistory ?? capabilities.state_transition_history),
      extensions: capabilities.extensions ?? [],
    },
    securitySchemes: anyCard.securitySchemes ?? anyCard.security_schemes ?? {},
    provider: anyCard.provider ?? null,
    documentationUrl: anyCard.documentationUrl ?? anyCard.documentation_url ?? null,
    skills: (anyCard.skills ?? []) as any[],
  };
}
