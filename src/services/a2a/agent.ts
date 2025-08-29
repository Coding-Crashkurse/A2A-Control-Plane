import type { AgentCard } from "./types";

export async function fetchAgentCard(cardUrl:string):Promise<AgentCard>{
  const res = await fetch(cardUrl);
  if(!res.ok) throw new Error(`Card fetch failed ${res.status}`);
  return await res.json();
}

export function isRestCapable(card:AgentCard):boolean{
  if(card.preferredTransport==="HTTP+JSON") return true;
  return !!card.additionalInterfaces?.some(i=>i.transport==="HTTP+JSON");
}
