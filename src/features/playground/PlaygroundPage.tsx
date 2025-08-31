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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
} from "@mui/material";
import { Send, Bolt, PlayArrow, RestartAlt, ExpandMore } from "@mui/icons-material";
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

  // Inspector
  statusText?: string;
  artifacts?: any[];
};

function textFromParts(parts?: any[]) {
  if (!Array.isArray(parts)) return "";
  return parts.filter((p) => p?.kind === "text" && typeof p.text === "string").map((p) => p.text).join("\n");
}

function colorForState(s?: TaskState): any {
  switch (s) {
    case "completed":
      return "success";
    case "working":
      return "warning";
    case "failed":
    case "rejected":
      return "error";
    case "submitted":
    case "input-required":
      return "info";
    case "auth-required":
      return "secondary";
    case "canceled":
      return "default";
    default:
      return "default";
  }
}

export default function PlaygroundPage() {
  const { activeConn, activeId } = useAgents();

  const [taskId, setTaskId] = useState<string | undefined>();
  const [contextId, setContextId] = useState<string | undefined>();
  const [lastState, setLastState] = useState<TaskState | undefined>();
  const [mode, setMode] = useState<"blocking" | "stream">("stream");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);

  // Inspector state
  const [statusText, setStatusText] = useState<string>(""); // optional agent note
  const [artifacts, setArtifacts] = useState<any[]>([]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingAgentIdRef = useRef<string | null>(null);

  // Snapshot of all UI states so persist never writes with stale values
  const snapRef = useRef<SavedState>({
    msgs: [],
    taskId: undefined,
    contextId: undefined,
    mode: "stream",
    lastState: undefined,
    statusText: "",
    artifacts: [],
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
      statusText: snapRef.current.statusText ?? base.statusText,
      artifacts: snapRef.current.artifacts ?? base.artifacts ?? [],
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
        setStatusText(s.statusText ?? "");
        setArtifacts(s.artifacts ?? []);
        pendingAgentIdRef.current =
          [...(s.msgs ?? [])].reverse().find((m) => m.role === "agent" && m.pending)?.id ?? null;

        // update snapshot immediately
        snapRef.current = {
          msgs: s.msgs ?? [],
          taskId: s.taskId,
          contextId: s.contextId,
          mode: s.mode ?? "stream",
          lastState: s.lastState,
          statusText: s.statusText ?? "",
          artifacts: s.artifacts ?? [],
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
        setStatusText("");
        setArtifacts([]);
        pendingAgentIdRef.current = null;
        snapRef.current = {
          msgs: [],
          taskId: undefined,
          contextId: undefined,
          mode: "stream",
          lastState: undefined,
          statusText: "",
          artifacts: [],
        };
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

  // -------- Inspector helpers
  const setNoteFromMessage = (msg: any) => {
    if (!msg) return;
    const t = textFromParts(msg.parts);
    if (t) {
      setStatusText(t);
      updateSnap({ statusText: t });
      persist();
    }
  };

  const replaceArtifacts = (arr?: any[]) => {
    if (!Array.isArray(arr)) return;
    setArtifacts(arr);
    updateSnap({ artifacts: arr });
    persist();
  };

  const upsertArtifact = (a: any, append?: boolean) => {
    if (!a) return;
    setArtifacts((prev) => {
      const idx = prev.findIndex((x: any) => x?.artifactId === a.artifactId);
      let next = [...prev];
      if (idx >= 0) {
        if (append && Array.isArray(next[idx]?.parts) && Array.isArray(a.parts)) {
          next[idx] = { ...next[idx], parts: [...next[idx].parts, ...a.parts] };
        } else {
          next[idx] = { ...next[idx], ...a };
        }
      } else {
        next.push(a);
      }
      updateSnap({ artifacts: next });
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

        if (kind === "task") {
          if (ev?.id) {
            setTaskId(ev.id);
            updateSnap({ taskId: ev.id });
          }
          if (ev?.contextId) {
            setContextId(ev.contextId);
            updateSnap({ contextId: ev.contextId });
          }
          if (ev?.status?.state) {
            setLastState(ev.status.state);
            updateSnap({ lastState: ev.status.state });
          }
          if (Array.isArray(ev?.artifacts)) replaceArtifacts(ev.artifacts);
          if (ev?.status?.message) setNoteFromMessage(ev.status.message);
          persist();
        }

        if (kind === "status-update") {
          if (!snapRef.current.taskId && ev?.taskId) {
            setTaskId(ev.taskId);
            updateSnap({ taskId: ev.taskId });
          }
          if (ev?.contextId && !snapRef.current.contextId) {
            setContextId(ev.contextId);
            updateSnap({ contextId: ev.contextId });
          }
          if (ev?.status?.state) {
            setLastState(ev.status.state);
            updateSnap({ lastState: ev.status.state });
          }
          if (ev?.status?.message) {
            const ttxt = textFromParts(ev.status.message.parts);
            if (ttxt) {
              if (!bubbleId) bubbleId = createAgentBubble();
              acc = acc ? `${acc}\n${ttxt}` : ttxt;
              updateAgentMsg(bubbleId!, acc, true);
            }
            setNoteFromMessage(ev.status.message);
          }
          persist();
        }

        if (kind === "message" && ev.role === "agent") {
          const parts = ev.parts || [];
          const ttxt = textFromParts(parts);
          if (ttxt) {
            if (!bubbleId) bubbleId = createAgentBubble();
            acc += (acc ? "" : "") + ttxt;
            updateAgentMsg(bubbleId!, acc, true);
            setStatusText(ttxt);
            updateSnap({ statusText: ttxt });
            persist();
          }
        } else if (kind === "artifact-update") {
          upsertArtifact(ev.artifact, ev.append);
          const parts = (ev.artifact?.parts || []).filter((p: any) => p.kind === "text");
          if (parts.length) {
            if (!bubbleId) bubbleId = createAgentBubble();
            acc += parts.map((p: any) => p.text).join("");
            updateAgentMsg(bubbleId!, acc, true);
          }
        }

        if (kind === "status-update") {
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

          // Inspector from Task result
          if (Array.isArray(t?.artifacts)) replaceArtifacts(t.artifacts);
          if (t?.status?.message) setNoteFromMessage(t.status.message);

          const lastAgent = (t.history || []).slice().reverse().find((m: any) => m.role === "agent");
          const txt =
            lastAgent && (lastAgent.parts || []).some((p: any) => p.kind === "text")
              ? (lastAgent.parts || []).filter((p: any) => p.kind === "text").map((p: any) => p.text).join("\n\n")
              : "(completed)";
          updateAgentMsg(id, txt, false);
          persist();
        } else {
          const m = res as any;
          if (m.taskId) {
            setTaskId(m.taskId);
            updateSnap({ taskId: m.taskId });
            persist();
          }
          setLastState("completed");
          updateSnap({ lastState: "completed" });
          const txt =
            (m.parts || []).filter((p: any) => p.kind === "text").map((p: any) => p.text).join("\n\n") || "(completed)";
          updateAgentMsg(id, txt, false);
          setStatusText(txt);
          updateSnap({ statusText: txt });
          persist();
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
          if (Array.isArray(ev?.artifacts)) replaceArtifacts(ev.artifacts);
          if (ev?.status?.message) setNoteFromMessage(ev.status.message);
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
          if (ev?.status?.message) {
            const ttxt = textFromParts(ev.status.message.parts);
            if (ttxt) {
              acc = acc ? `${acc}\n${ttxt}` : ttxt;
              updateAgentMsg(bubbleId, acc, true);
            }
            setNoteFromMessage(ev.status.message);
          }
        }

        if (kind === "message" && ev.role === "agent") {
          const parts = (ev.parts || []);
          const ttxt = textFromParts(parts);
          if (ttxt) {
            acc += ttxt;
            updateAgentMsg(bubbleId, acc, true);
            setStatusText(ttxt);
            updateSnap({ statusText: ttxt });
            persist();
          }
        } else if (kind === "artifact-update") {
          upsertArtifact(ev.artifact, ev.append);
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
    setStatusText("");
    setArtifacts([]);
    pendingAgentIdRef.current = null;
    updateSnap({
      msgs: [],
      taskId: undefined,
      contextId: undefined,
      lastState: undefined,
      statusText: "",
      artifacts: [],
    });
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
            {lastState && <Chip size="small" label={`state: ${lastState}`} color={colorForState(lastState)} />}
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

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 360px" },
          gridTemplateRows: "1fr auto",
          gap: 1.5,
          height: "calc(100vh - 180px)",
        }}
      >
        {/* Chat panel */}
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}
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

        {/* Inspector panel */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Task inspector
          </Typography>

          {/* State */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              State
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip size="small" label={lastState ?? "—"} color={colorForState(lastState)} />
            </Box>
          </Box>

          {/* Agent message (optional) */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Agent message
            </Typography>
            <Paper variant="outlined" sx={{ p: 1, mt: 0.5, borderRadius: 1.5 }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {statusText || "—"}
              </Typography>
            </Paper>
          </Box>

          {/* Artifacts */}
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Typography variant="caption" color="text.secondary">
              Artifacts
            </Typography>
            <Box sx={{ overflowY: "auto", mt: 0.5, pr: 0.5 }}>
              {artifacts?.length ? (
                <Stack spacing={1}>
                  {artifacts.map((a: any) => (
                    <Accordion key={a.artifactId} disableGutters sx={{ "&:before": { display: "none" } }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%", overflow: "hidden" }}>
                          <Typography variant="body2" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.name || a.artifactId}
                          </Typography>
                          <Chip size="small" label={a?.parts?.[0]?.kind || "parts"} />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        {a.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                            {a.description}
                          </Typography>
                        )}
                        {(a.parts || []).map((p: any, idx: number) => {
                          if (p.kind === "text") {
                            return (
                              <Paper key={idx} variant="outlined" sx={{ p: 1, mb: 1 }}>
                                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                  {p.text}
                                </Typography>
                              </Paper>
                            );
                          }
                          if (p.kind === "data") {
                            return (
                              <Paper key={idx} variant="outlined" sx={{ p: 1, mb: 1 }}>
                                <Typography component="pre" variant="caption" sx={{ m: 0, whiteSpace: "pre-wrap" }}>
                                  {JSON.stringify(p.data, null, 2)}
                                </Typography>
                              </Paper>
                            );
                          }
                          if (p.kind === "file") {
                            const f = p.file || {};
                            const mime = f?.mimeType || f?.mime_type;
                            const isImg = (mime || "").toString().startsWith("image/") && typeof f?.uri === "string";
                            return (
                              <Paper key={idx} variant="outlined" sx={{ p: 1, mb: 1 }}>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                  {f?.name || "file"}{" "}
                                  {mime ? (
                                    <Typography component="span" variant="caption" color="text.secondary">
                                      ({mime})
                                    </Typography>
                                  ) : null}
                                </Typography>
                                {isImg ? (
                                  <Box
                                    component="img"
                                    src={f.uri}
                                    alt={f?.name || "image"}
                                    sx={{ maxWidth: "100%", borderRadius: 1 }}
                                  />
                                ) : f?.uri ? (
                                  <Link href={f.uri} target="_blank" rel="noopener" underline="hover">
                                    Open file
                                  </Link>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    bytes provided
                                  </Typography>
                                )}
                              </Paper>
                            );
                          }
                          return (
                            <Typography key={idx} variant="caption" color="text.secondary">
                              Unsupported part
                            </Typography>
                          );
                        })}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No artifacts yet.
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Input bar spanning all columns */}
        <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, gridColumn: { xs: "1 / -1", md: "1 / -1" } }}>
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
