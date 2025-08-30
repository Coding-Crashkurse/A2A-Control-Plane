import type { SendParams, Task, Message as A2AMessage } from "./types";
import type { AgentConn } from "./http";
import { reqJSON, reqSSE } from "./http";

/** List all tasks */
export function listTasks(conn: AgentConn): Promise<Task[]> {
  return reqJSON(conn, "/v1/tasks");
}

/** Get a single task */
export function getTask(conn: AgentConn, id: string): Promise<Task> {
  return reqJSON(conn, `/v1/tasks/${encodeURIComponent(id)}`);
}

/** Cancel a task */
export function cancelTask(conn: AgentConn, id: string): Promise<Task> {
  return reqJSON(conn, `/v1/tasks/${encodeURIComponent(id)}:cancel`, {
    method: "POST",
  });
}

/** Send a message (non-streaming) */
export function sendMessage(
  conn: AgentConn,
  body: SendParams
): Promise<Task | A2AMessage> {
  return reqJSON(conn, "/v1/message:send", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** Stream a message (SSE) */
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

/** Re-subscribe to a task's stream (SSE) */
export async function resubscribeTask(
  conn: AgentConn,
  id: string,
  onEvent: (e: any) => void
) {
  // Spec: POST /v1/tasks/{id}:subscribe
  await reqSSE(conn, `/v1/tasks/${encodeURIComponent(id)}:subscribe`, {
    method: "POST",
    onEvent,
  });
}
