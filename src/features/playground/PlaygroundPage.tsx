// src/features/playground/PlaygroundPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  IconButton,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Tooltip,
} from "@mui/material";
import { Send, Bolt, PlayArrow, RestartAlt } from "@mui/icons-material";
import dayjs from "dayjs";

import PageHeader from "../../components/PageHeader";
import EmptyState, { Steps } from "../../components/EmptyState";
import { useAgents } from "../../context/AgentContext";
import { sendMessage, streamMessage, resubscribeTask } from "../../services/a2a/restClient";
import type { Message, SendParams, TaskState } from "../../services/a2a/types";

const ACTIVE = new Set<TaskState>(["working", "submitted", "input-required", "auth-required"]);
const log = (...a: any[]) => console.log("[PG]", ...a);
const keyOf = (agentId: string) => `pg:${agentId}`;

// prevents double subscriptions on tab switch
const subscribeLocks = new Map<string, true>();
const resumeCooldown = new Map<string, number>(); // debounce focus/visibility

type ChatMsg = { id: string; role: "user" | "agent"; text: string; ts: number; pending?: boolean };
type SavedState = {
  msgs: ChatMsg[];
  taskId?: string;
  contextId?: string;
  mode: "blocking" | "stream";
  lastState?: TaskState;
};

export default function PlaygroundPage() {
  const { activeConn, activeId } = useAgents();

  const [taskId, setTaskId] = useState<string | undefined>();
  const [contextId, setContextId] = useState<string | undefined>();
  const [lastState, setLastState] = useState<TaskState | undefined>();
  const [mode, setMode] = useState<"blocking" | "stream">("stream");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingAgentIdRef = useRef<string | null>(null);

  // Snapshot of all UI states so persist never writes with stale values
  const snapRef = useRef<SavedState>({
    msgs: [],
    taskId: undefined,
    contextId: undefined,
    mode: "stream",
    lastState: undefined,
  });

  const updateSnap = (patch: Partial<SavedState>) => {
    snapRef.current = { ...snapRef.current, ...patch };
  };

  const persist = (patch?: Partial<SavedState>) => {
    if (!activeId) return;
    // load old JSON as base (prevents “resetting” due to stale React state)
    const base: Partial<SavedState> =
      JSON.parse(sessionStorage.getItem(keyOf(activeId)) || "{}") || {};
    const merged: SavedState = {
      msgs: snapRef.current.msgs.length ? snapRef.current.msgs : base.msgs ?? [],
      taskId: snapRef.current.taskId ?? base.taskId,
      contextId: snapRef.current.contextId ?? base.contextId,
      mode: snapRef.current.mode ?? (base.mode as any) ?? "stream",
      lastState: snapRef.current.lastState ?? (base.lastState as any),
      ...(patch || {}),
    };
    sessionStorage.setItem(keyOf(activeId), JSON.stringify(merged));
    snapRef.current = merged;
  };

  // -------- Restore on agent switch / page load
  useEffect(() => {
    if (!activeId) return;
    try {
      const raw = sessionStorage.getItem(keyOf(activeId));
      if (raw) {
        const s: SavedState = JSON.parse(raw);
        setMsgs(s.msgs ?? []);
        setTaskId(s.taskId);
        setContextId(s.contextId);
        setMode(s.mode ?? "stream");
        setLastState(s.lastState);
        pendingAgentIdRef.current =
          [...(s.msgs ?? [])].reverse().find((m) => m.role === "agent" && m.pending)?.id ?? null;

        // update snapshot immediately
        snapRef.current = {
          msgs: s.msgs ?? [],
          taskId: s.taskId,
          contextId: s.contextId,
          mode: s.mode ?? "stream",
          lastState: s.lastState,
        };
        log("restored", { taskId: s.taskId, lastState: s.lastState, msgs: s.msgs?.length ?? 0 });

        // if active → resubscribe immediately
        if (s.taskId && s.lastState && ACTIVE.has(s.lastState)) {
          setTimeout(() => subscribeOnce("mount-restore", s.taskId!), 0);
        }
      } else {
        setMsgs([]);
        setTaskId(undefined);
        setContextId(undefined);
        setMode("stream");
        setLastState(undefined);
        pendingAgentIdRef.current = null;
        snapRef.current = { msgs: [], taskId: undefined, contextId: undefined, mode: "stream", lastState: undefined };
        log("no saved state");
      }
    } catch (e) {
      log("restore error", e);
    }
  }, [activeId]);

  // Auto-scroll
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  // -------- Message helpers
  const pushUser = (text: string) => {
    const m: ChatMsg = { id: crypto.randomUUID(), role: "user", text, ts: Date.now() };
    setMsgs((prev) => {
      const next = [...prev, m];
      updateSnap({ msgs: next });
      persist();
      return next;
    });
  };

  const createAgentBubble = () => {
    const id = crypto.randomUUID();
    const m: ChatMsg = { id, role: "agent", text: "", ts: Date.now(), pending: true };
    setMsgs((prev) => {
      const next = [...prev, m];
      updateSnap({ msgs: next });
      persist();
      return next;
    });
    pendingAgentIdRef.current = id;
    return id;
  };

  const updateAgentMsg = (id: string, text: string, pending?: boolean) => {
    setMsgs((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, text, pending } : x));
      updateSnap({ msgs: next });
      persist();
      return next;
    });
  };

  // -------- Send params
  const buildSendParams = (text: string): SendParams => {
    const message: Message = {
      kind: "message",
      role: "user",
      messageId: crypto.randomUUID(),
      parts: [{ kind: "text", text }],
      ...(taskId ? { taskId } : {}),
      ...(contextId ? { contextId } : {}),
    };
    return {
      message,
      configuration: {
        blocking: mode === "blocking",
        historyLength: 12,
      },
    };
  };

  // -------- Auto-Resume (visibility/focus)
  const subscribeOnce = async (reason: string, tid?: string) => {
    if (!activeConn || !activeId) return;
    const useTid = tid ?? snapRef.current.taskId ?? taskId;
    if (!useTid) return;
    if (snapRef.current.lastState && !ACTIVE.has(snapRef.current.lastState)) return;

    const guardKey = `${activeId}|${useTid}`;
    const t = Date.now();
    if ((resumeCooldown.get(guardKey) ?? 0) > t - 800) return;
    resumeCooldown.set(guardKey, t);

    const lockKey = guardKey;
    if (subscribeLocks.has(lockKey)) return;
    subscribeLocks.set(lockKey, true);
    setSending(true);
    log("POST :subscribe", { reason, taskId: useTid });

    let bubbleId = pendingAgentIdRef.current;
    let acc = bubbleId ? (snapRef.current.msgs.find((m) => m.id === bubbleId)?.text ?? "") : "";

    try {
      await resubscribeTask(activeConn, useTid, (ev: any) => {
        const kind = ev?.kind;

        if (kind === "status-update") {
          if (!snapRef.current.taskId && ev?.taskId) {
            setTaskId(ev.taskId);
            updateSnap({ taskId: ev.taskId });
            persist();
          }
          if (ev?.contextId && !snapRef.current.contextId) {
            setContextId(ev.contextId);
            updateSnap({ contextId: ev.contextId });
            persist();
          }
          if (ev?.status?.state) {
            setLastState(ev.status.state);
            updateSnap({ lastState: ev.status.state });
            persist();
          }
        }

        if (kind === "message" && ev.role === "agent") {
          if (!bubbleId) bubbleId = createAgentBubble();
          const parts = (ev.parts || []).filter((p: any) => p.kind === "text");
          if (parts.length) {
            acc += parts.map((p: any) => p.text).join("");
            updateAgentMsg(bubbleId!, acc, true);
          }
        } else if (kind === "artifact-update") {
          const parts = (ev.artifact?.parts || []).filter((p: any) => p.kind === "text");
          if (parts.length) {
            if (!bubbleId) bubbleId = createAgentBubble();
            acc += parts.map((p: any) => p.text).join("");
            updateAgentMsg(bubbleId!, acc, true);
          }
        } else if (kind === "status-update") {
          if (ev?.final || ["completed", "failed", "canceled"].includes(ev?.status?.state)) {
            if (bubbleId) updateAgentMsg(bubbleId, acc || "(completed)", false);
            setSending(false);
            subscribeLocks.delete(lockKey);
            pendingAgentIdRef.current = null;
            log("subscribe finished");
          }
        }
        log("SSE (resume)", kind, ev);
      });
    } catch (e) {
      log("subscribe error", e);
      if (bubbleId) updateAgentMsg(bubbleId, acc ? acc : "Error while resubscribing", false);
      setSending(false);
      subscribeLocks.delete(lockKey);
      pendingAgentIdRef.current = null;
    }
  };

  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && subscribeOnce("visibility");
    const onFocus = () => subscribeOnce("focus");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConn, activeId]);

  // -------- Send
  const onSend = async () => {
    if (!activeConn) return;
    const text = input.trim();
    if (!text) return;

    setInput("");
    pushUser(text);
    setSending(true);

    const params = buildSendParams(text);

    if (mode === "blocking") {
      log("send (blocking)", params);
      try {
        const res = await sendMessage(activeConn, params);
        const id = createAgentBubble();

        if ((res as any).kind === "task") {
          const t = res as any;
          setTaskId(t.id);
          setContextId(t.contextId);
          setLastState(t?.status?.state);
          updateSnap({ taskId: t.id, contextId: t.contextId, lastState: t?.status?.state });
          persist();

          const lastAgent = (t.history || []).slice().reverse().find((m: any) => m.role === "agent");
          const txt =
            lastAgent && (lastAgent.parts || []).some((p: any) => p.kind === "text")
              ? (lastAgent.parts || []).filter((p: any) => p.kind === "text").map((p: any) => p.text).join("\n\n")
              : "(completed)";
          updateAgentMsg(id, txt, false);
        } else {
          const m = res as any;
          if (m.taskId) {
            setTaskId(m.taskId);
            updateSnap({ taskId: m.taskId });
            persist();
          }
          // Direct message implies no task lifecycle. Treat as completed reply.
          setLastState("completed");
          updateSnap({ lastState: "completed" });
          persist();

          const txt =
            (m.parts || []).filter((p: any) => p.kind === "text").map((p: any) => p.text).join("\n\n") || "(completed)";
          updateAgentMsg(id, txt, false);
        }
      } catch (e: any) {
        const id = createAgentBubble();
        updateAgentMsg(id, `Error: ${e.message ?? e}`, false);
      } finally {
        setSending(false);
      }
      return;
    }

    // stream
    log("send (stream)", params);
    const bubbleId = createAgentBubble();
    let acc = "";

    setLastState("working");
    updateSnap({ lastState: "working" });
    persist();

    try {
      await streamMessage(activeConn, params, (ev: any) => {
        const kind = ev?.kind;

        if (kind === "task") {
          setTaskId(ev.id);
          setContextId(ev.contextId);
          updateSnap({ taskId: ev.id, contextId: ev.contextId });
          persist();
        }

        if (kind === "status-update") {
          if (!snapRef.current.taskId && ev?.taskId) {
            setTaskId(ev.taskId);
            updateSnap({ taskId: ev.taskId });
            persist();
            log("stream: taskId from status-update", ev.taskId);
          }
          if (!snapRef.current.contextId && ev?.contextId) {
            setContextId(ev.contextId);
            updateSnap({ contextId: ev.contextId });
            persist();
          }
          if (ev?.status?.state) {
            setLastState(ev.status.state);
            updateSnap({ lastState: ev.status.state });
            persist();
          }
        }

        if (kind === "message" && ev.role === "agent") {
          const parts = (ev.parts || []).filter((p: any) => p.kind === "text");
          if (parts.length) {
            acc += parts.map((p: any) => p.text).join("");
            updateAgentMsg(bubbleId, acc, true);
          }
        } else if (kind === "artifact-update") {
          const parts = (ev.artifact?.parts || []).filter((p: any) => p.kind === "text");
          if (parts.length) {
            acc += parts.map((p: any) => p.text).join("");
            updateAgentMsg(bubbleId, acc, true);
          }
        } else if (kind === "status-update") {
          if (ev?.final || ["completed", "failed", "canceled"].includes(ev?.status?.state)) {
            updateAgentMsg(bubbleId, acc || "(completed)", false);
            setSending(false);
            pendingAgentIdRef.current = null;
          }
        }

        log("SSE (stream)", kind, ev);
      });
    } catch (e: any) {
      updateAgentMsg(bubbleId, `Error: ${e.message ?? e}`, false);
      setSending(false);
      pendingAgentIdRef.current = null;
    }
  };

  const onClear = () => {
    setMsgs([]);
    setTaskId(undefined);
    setContextId(undefined);
    setLastState(undefined);
    pendingAgentIdRef.current = null;
    updateSnap({ msgs: [], taskId: undefined, contextId: undefined, lastState: undefined });
    if (activeId) sessionStorage.removeItem(keyOf(activeId));
    log("cleared chat");
  };

  if (!activeConn || !activeId) {
    return (
      <>
        <PageHeader title="Playground" subtitle="Activate an agent to send messages." />
        <EmptyState
          title="No active agent"
          subtitle="Add a REST-capable agent in the “Agents” tab or activate one."
          actions={<Button onClick={() => (window.location.href = "/agents")}>Go to “Agents”</Button>}
        >
          <Steps />
        </EmptyState>
      </>
    );
  }

  const canSend = !!activeConn && input.trim().length > 0 && !sending;

  return (
    <>
      <PageHeader
        title="Playground"
        subtitle="Chat UI for message:send / message:stream – auto-resume when you return."
        actions={
          <Stack direction="row" spacing={1}>
            {taskId && <Chip size="small" label={`task: ${taskId.slice(0, 8)}…`} />}
            {contextId && <Chip size="small" label={`ctx: ${contextId.slice(0, 8)}…`} />}
            {lastState && <Chip size="small" label={`state: ${lastState}`} />}
            <ToggleButtonGroup size="small" value={mode} exclusive onChange={(_, v) => v && setMode(v)}>
              <ToggleButton value="blocking">
                <PlayArrow fontSize="small" sx={{ mr: 0.5 }} />
                blocking
              </ToggleButton>
              <ToggleButton value="stream">
                <Bolt fontSize="small" sx={{ mr: 0.5 }} />
                stream
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Reset conversation">
              <span>
                <Button size="small" variant="outlined" startIcon={<RestartAlt />} onClick={onClear} disabled={sending}>
                  Reset
                </Button>
              </span>
            </Tooltip>
          </Stack>
        }
      />

      <Box sx={{ display: "grid", gridTemplateRows: "1fr auto", height: "calc(100vh - 180px)" }}>
        <Paper
          variant="outlined"
          sx={{ p: 2, mb: 1.5, borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          <Stack ref={listRef} spacing={1.5} sx={{ overflowY: "auto", pr: 1, height: "100%" }}>
            {msgs.map((m) => (
              <Stack key={m.id} alignItems={m.role === "user" ? "flex-end" : "flex-start"}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1,
                    px: 1.5,
                    maxWidth: "80%",
                    borderRadius: 2,
                    bgcolor: m.role === "user" ? "primary.main" : "background.paper",
                    color: m.role === "user" ? "primary.contrastText" : "text.primary",
                    border: "1px solid",
                    borderColor: m.role === "user" ? "primary.main" : "divider",
                  }}
                >
                  <Typography component="pre" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {m.text || (m.pending ? "…" : "")}
                  </Typography>
                </Paper>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                  {m.role} • {dayjs(m.ts).format("HH:mm:ss")}
                  {m.pending ? " • typing…" : ""}
                </Typography>
              </Stack>
            ))}
            {msgs.length === 0 && (
              <Box sx={{ textAlign: "center", color: "text.secondary", py: 6 }}>
                <Typography variant="body2">No messages yet. Type something below and click Send.</Typography>
              </Box>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              label="Message"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) onSend();
                }
              }}
              multiline
              maxRows={4}
            />
            <Tooltip title={mode === "stream" ? "Stream" : "Blocking"}>
              <span>
                <IconButton color="primary" disabled={!canSend} onClick={onSend}>
                  <Send />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>
      </Box>
    </>
  );
}
