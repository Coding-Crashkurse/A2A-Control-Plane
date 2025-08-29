import { createContext, useContext, useMemo, useState, useEffect } from "react";
import type { AgentCard } from "../services/a2a/types";
import type { AgentConn } from "../services/a2a/http";

export type AgentRecord = {
  id: string;
  name: string;
  baseUrl: string;
  cardUrl?: string;
  headers?: Record<string, string>;
  version?: string;
};

type Ctx = {
  agents: AgentRecord[];
  activeId: string | null;
  activeConn: AgentConn | null;
  addByCard: (cardUrl: string, authHeader?: string) => Promise<void>;
  setActive: (id: string) => void;
  remove: (id: string) => void;
};

const AgentCtx = createContext<Ctx | undefined>(undefined);

const LS_AGENTS = "a2a_agents";
const LS_ACTIVE = "a2a_active";

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<AgentRecord[]>(
    () => JSON.parse(localStorage.getItem(LS_AGENTS) || "[]")
  );
  const [activeId, setActiveId] = useState<string | null>(
    () => localStorage.getItem(LS_ACTIVE)
  );

  useEffect(() => localStorage.setItem(LS_AGENTS, JSON.stringify(agents)), [agents]);
  useEffect(() => {
    if (activeId) localStorage.setItem(LS_ACTIVE, activeId);
    else localStorage.removeItem(LS_ACTIVE);
  }, [activeId]);

  async function fetchCard(cardUrl: string): Promise<AgentCard> {
    const r = await fetch(cardUrl);
    if (!r.ok) throw new Error(`Card fetch failed ${r.status}`);
    return (await r.json()) as AgentCard;
  }

  function pickRestBase(card: AgentCard): string | null {
    if (card.preferredTransport === "HTTP+JSON") return card.url;
    const ai = card.additionalInterfaces?.find((i) => i.transport === "HTTP+JSON");
    return ai?.url ?? null;
  }

  const addByCard = async (cardUrl: string, authHeader?: string) => {
    const card = await fetchCard(cardUrl);
    const baseUrl = pickRestBase(card);
    if (!baseUrl) throw new Error("Agent ohne REST (HTTP+JSON) wird abgelehnt.");
    const id = "agent-" + Math.random().toString(36).slice(2, 8);
    const headers = authHeader ? { Authorization: authHeader } : undefined;
    const rec: AgentRecord = {
      id,
      name: card.name,
      baseUrl,
      cardUrl,
      headers,
      version: card.version,
    };
    setAgents((a) => [rec, ...a]);
    setActiveId(id);
  };

  const setActive = (id: string) => setActiveId(id);
  const remove = (id: string) => {
    setAgents((a) => a.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const activeConn = useMemo<AgentConn | null>(() => {
    const ag = agents.find((x) => x.id === activeId);
    return ag ? { baseUrl: ag.baseUrl, headers: ag.headers } : null;
  }, [agents, activeId]);

  const value: Ctx = { agents, activeId, activeConn, addByCard, setActive, remove };
  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}

export function useAgents() {
  const ctx = useContext(AgentCtx);
  if (!ctx) throw new Error("useAgents outside AgentProvider");
  return ctx;
}
