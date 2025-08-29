import type { SendParams, Task, Message as A2AMessage } from "./types";
import type { AgentConn } from "./http";
import { reqJSON, reqSSE } from "./http";

export function listTasks(conn: AgentConn): Promise<Task[]> {
  return reqJSON(conn, "/v1/tasks");
}

export function getTask(conn: AgentConn, id: string): Promise<Task> {
  return reqJSON(conn, `/v1/tasks/${id}`);
}

export function cancelTask(conn: AgentConn, id: string): Promise<Task> {
  return reqJSON(conn, `/v1/tasks/${id}:cancel`, { method: "POST" });
}

export function sendMessage(
  conn: AgentConn,
  body: SendParams
): Promise<Task | A2AMessage> {
  return reqJSON(conn, "/v1/message:send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function streamMessage(
  conn: AgentConn,
  body: SendParams,
  onEvent: (e: any) => void
) {
  await reqSSE(conn, "/v1/message:stream", {
    method: "POST",
    body: JSON.stringify(body),
    onEvent,
    headers: { "Content-Type": "application/json" },
  });
}

export async function resubscribeTask(
  conn: AgentConn,
  id: string,
  onEvent: (e: any) => void
) {
  // Spec: POST /v1/tasks/{id}:subscribe
  await reqSSE(conn, `/v1/tasks/${id}:subscribe`, {
    method: "POST",
    onEvent,
  });
}
