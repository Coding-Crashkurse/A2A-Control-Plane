import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AgentCard } from "../services/a2a/types";
import type { AgentConn } from "../services/a2a/http";
import { defaultConn } from "../services/a2a/http";
import { configureProxy } from "../services/a2a/agent";

export type AgentRecord = {
  id: string;
  name: string;
  baseUrl: string;       // vom UI-Server aufgelöste REST-Base (nur Anzeige)
  cardUrl?: string;
  version?: string;
  auth?: string;         // eingegebener Auth-Header (nur Anzeige)
  card?: AgentCard;      // gecachte Card für UI
};

type AgentCtx = {
  agents: AgentRecord[];
  activeId: string | null;
  activeConn: AgentConn | null;                 // -> Dashboard erwartet das
  addByCard: (cardUrl: string, authHeader?: string) => Promise<void>;
  setActive: (id: string) => void;
  remove: (id: string) => void;
};

const Ctx = createContext<AgentCtx | null>(null);

const LS_AGENTS = "a2a_agents";
const LS_ACTIVE = "a2a_active";

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<AgentRecord[]>(
    () => JSON.parse(localStorage.getItem(LS_AGENTS) || "[]")
  );
  const [activeId, setActiveId] = useState<string | null>(
    () => localStorage.getItem(LS_ACTIVE)
  );

  useEffect(() => {
    localStorage.setItem(LS_AGENTS, JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    if (activeId) localStorage.setItem(LS_ACTIVE, activeId);
    else localStorage.removeItem(LS_ACTIVE);
  }, [activeId]);

  const addByCard = async (cardUrl: string, authHeader?: string) => {
    // Proxy am UI-Server konfigurieren und Card zurückholen
    const data = await configureProxy({
      cardUrl,
      authBearer: authHeader && authHeader.trim() ? authHeader.trim() : undefined,
    });
    if (!data.restBase) throw new Error("Could not resolve REST base from Agent Card.");

    const card = data.card as AgentCard | undefined;
    const id = "agent-" + Math.random().toString(36).slice(2, 8);
    const rec: AgentRecord = {
      id,
      name: (card as any)?.name ?? cardUrl,
      version: (card as any)?.version,
      baseUrl: data.restBase,
      cardUrl,
      auth: authHeader,
      card,
    };
    setAgents((prev) => [rec, ...prev]);
    setActiveId(id);
  };

  const setActive = (id: string) => setActiveId(id);

  const remove = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  };

  // WICHTIG: Browser spricht IMMER mit dem Proxy (/api). Authorization macht der Server.
  const activeConn = useMemo<AgentConn | null>(() => {
    const ag = agents.find((x) => x.id === activeId);
    return ag ? defaultConn : null; // defaultConn = { baseUrl: "/api" }
  }, [agents, activeId]);

  const value: AgentCtx = { agents, activeId, activeConn, addByCard, setActive, remove };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgents(): AgentCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAgents must be used within AgentProvider");
  return ctx;
}
