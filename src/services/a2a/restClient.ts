// REST client that ALWAYS talks to the proxy at /api.

import type { SendParams, Task, Message as A2AMessage } from "./types";
import type { AgentConn } from "./http";
import { reqJSON, reqSSE, defaultConn } from "./http";

export function listTasks(conn: AgentConn = defaultConn): Promise<Task[]> {
  return reqJSON(conn, "/v1/tasks");
}

export function getTask(conn: AgentConn = defaultConn, id: string): Promise<Task> {
  return reqJSON(conn, `/v1/tasks/${encodeURIComponent(id)}`);
}

export function cancelTask(conn: AgentConn = defaultConn, id: string): Promise<Task> {
  return reqJSON(conn, `/v1/tasks/${encodeURIComponent(id)}:cancel`, {
    method: "POST",
  });
}

export function sendMessage(
  conn: AgentConn = defaultConn,
  body: SendParams
): Promise<Task | A2AMessage> {
  return reqJSON(conn, "/v1/message:send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function streamMessage(
  conn: AgentConn = defaultConn,
  body: SendParams,
  onEvent: (e: any) => void
) {
  await reqSSE(conn, "/v1/message:stream", {
    method: "POST",
    body: JSON.stringify(body),
    onEvent,
  });
}

export async function resubscribeTask(
  conn: AgentConn = defaultConn,
  id: string,
  onEvent: (e: any) => void
) {
  await reqSSE(conn, `/v1/tasks/${encodeURIComponent(id)}:subscribe`, {
    method: "POST",
    onEvent,
  });
}
