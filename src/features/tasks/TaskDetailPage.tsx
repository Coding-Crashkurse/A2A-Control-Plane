import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Paper,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  CheckCircleOutline,
  Autorenew,
  ErrorOutline,
  HelpOutline,
  HourglassEmpty,
  LockOutlined,
  Block,
  DoDisturbOutlined,
  ContentCopy,
  Download as DownloadIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";

import { getTask, cancelTask as cancelTaskApi } from "../../services/a2a/restClient";
import type {
  Task,
  TaskState,
  Message,
  Part,
  TextPart,
  FilePart,
  DataPart,
  Artifact,
} from "../../services/a2a/types";
import PageHeader from "../../components/PageHeader";
import { useAgents } from "../../context/AgentContext";

// ---------- helpers ----------
function parseTs(ts?: string): number | null {
  if (!ts) return null;
  const d = dayjs(ts);
  return d.isValid() ? d.valueOf() : null;
}
function fromNow(ts?: string) {
  const n = parseTs(ts);
  if (!n) return "—";
  const mins = Math.max(0, Math.round((Date.now() - n) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}
function fmt(ts?: string) {
  return ts ? dayjs(ts).format("YYYY-MM-DD HH:mm:ss") : "—";
}
function prettyJSON(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
function isTrivialText(p: TextPart) {
  const t = (p.text ?? "").trim().toLowerCase();
  return t === "" || t === "string";
}
function isTrivialData(p: DataPart) {
  const keys = Object.keys(p.data || {});
  return (
    keys.length === 0 ||
    (keys.length === 1 &&
      keys[0] === "additionalProp1" &&
      p.data &&
      typeof p.data.additionalProp1 === "object" &&
      Object.keys(p.data.additionalProp1).length === 0)
  );
}
function isTrivialFile(p: FilePart) {
  const f = p.file as any;
  return !f?.uri && !f?.bytes && !f?.name;
}
function partIsMeaningful(part: Part) {
  switch (part.kind) {
    case "text":
      return !isTrivialText(part as TextPart);
    case "data":
      return !isTrivialData(part as DataPart);
    case "file":
      return !isTrivialFile(part as FilePart);
    default:
      return true;
  }
}
function messageIsMeaningful(m: Message) {
  if (!m?.parts || m.parts.length === 0) return false;
  return m.parts.some(partIsMeaningful);
}
function artifactIsMeaningful(a: Artifact) {
  return a?.parts?.some(partIsMeaningful) ?? false;
}

function StateChip({ state }: { state: TaskState }) {
  switch (state) {
    case "completed":
      return <Chip size="small" color="success" icon={<CheckCircleOutline fontSize="small" />} label="completed" />;
    case "working":
      return <Chip size="small" color="warning" icon={<Autorenew fontSize="small" />} label="working" />;
    case "submitted":
      return <Chip size="small" color="info" icon={<HourglassEmpty fontSize="small" />} label="submitted" />;
    case "input-required":
      return <Chip size="small" color="info" icon={<HelpOutline fontSize="small" />} label="input-required" />;
    case "auth-required":
      return <Chip size="small" color="info" icon={<LockOutlined fontSize="small" />} label="auth-required" />;
    case "failed":
      return <Chip size="small" color="error" icon={<ErrorOutline fontSize="small" />} label="failed" />;
    case "rejected":
      return <Chip size="small" color="error" icon={<Block fontSize="small" />} label="rejected" />;
    case "canceled":
      return <Chip size="small" icon={<DoDisturbOutlined fontSize="small" />} label="canceled" />;
    case "unknown":
    default:
      return <Chip size="small" icon={<HelpOutline fontSize="small" />} label="unknown" />;
  }
}

// ---------- part render ----------
function TextBlock({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? "");
    } catch {}
  };
  return (
    <Paper variant="outlined" sx={{ p: 1, position: "relative", bgcolor: "background.paper" }}>
      <Typography
        component="pre"
        variant="body2"
        sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace" }}
      >
        {text ?? ""}
      </Typography>
      <Tooltip title="Copy">
        <IconButton size="small" onClick={copy} sx={{ position: "absolute", top: 4, right: 4 }}>
          <ContentCopy fontSize="inherit" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
function DataBlock({ data }: { data: any }) {
  const txt = prettyJSON(data);
  return <TextBlock text={txt} />;
}
function FileBlock({ file }: { file: FilePart["file"] }) {
  const f = file as any;
  const name = f?.name || "file";
  const mimeType = f?.mimeType ?? f?.mime_type; // beides unterstützen
  const mime = mimeType ? ` • ${mimeType}` : "";
  const uri = f?.uri as string | undefined;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip label={name + mime} />
      {uri ? (
        <Button size="small" variant="outlined" href={uri} target="_blank" startIcon={<DownloadIcon />}>
          Download
        </Button>
      ) : (
        <Tooltip title="No URI provided">
          <span>
            <Button size="small" variant="outlined" disabled startIcon={<DownloadIcon />}>
              Download
            </Button>
          </span>
        </Tooltip>
      )}
    </Stack>
  );
}
function renderPart(p: Part, idx: number) {
  if (!partIsMeaningful(p)) return null;
  switch (p.kind) {
    case "text":
      return <TextBlock key={idx} text={(p as TextPart).text} />;
    case "data":
      return <DataBlock key={idx} data={(p as DataPart).data} />;
    case "file":
      return <FileBlock key={idx} file={(p as FilePart).file} />;
    default:
      return null;
  }
}

// ---------- page ----------
export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id;
  const { activeConn } = useAgents();

  const {
    data: task,
    isPending,
    error,
    refetch,
  } = useQuery<Task>({
    queryKey: ["task", activeConn?.baseUrl, id],
    enabled: Boolean(activeConn && id),
    queryFn: () => getTask(activeConn!, id!),
  });

  const meaningfulHistory = useMemo(() => (task?.history ?? []).filter(messageIsMeaningful), [task?.history]);
  const meaningfulArtifacts = useMemo(() => (task?.artifacts ?? []).filter(artifactIsMeaningful), [task?.artifacts]);
  const userMsgs = meaningfulHistory.filter((m) => m.role === "user").length;
  const agentMsgs = meaningfulHistory.filter((m) => m.role === "agent").length;

  const cancelable =
    task?.status?.state &&
    ["working", "submitted", "input-required", "auth-required"].includes(task.status.state);

  // --- Cancel mutation + confirmation dialog ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const {
    mutateAsync: doCancel,
    isPending: canceling,
    error: cancelError,
  } = useMutation({
    mutationFn: async () => cancelTaskApi(activeConn!, id!),
    onSuccess: () => refetch(),
  });

  const confirmCancel = async () => {
    try {
      await doCancel();
      setConfirmOpen(false);
    } catch {
      // Error wird unten gezeigt
    }
  };

  return (
    <>
      <PageHeader
        title={`Task ${id ?? ""}`}
        subtitle={
          task ? (
            <>
              State: <StateChip state={task.status.state} /> · Updated: {fmt(task.status.timestamp)}
            </>
          ) : undefined
        }
        actions={
          cancelable ? (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<DoDisturbOutlined />}
              onClick={() => setConfirmOpen(true)}
              disabled={canceling}
            >
              Cancel
            </Button>
          ) : undefined
        }
      />

      {cancelError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(cancelError as Error).message}
        </Alert>
      )}
      {isPending && <Alert severity="info">Loading task…</Alert>}
      {error && <Alert severity="error">{String((error as Error).message)}</Alert>}
      {!task && !isPending && !error && <Alert severity="warning">No task found.</Alert>}

      {task && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
          {/* Status */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Status
            </Typography>
            <Stack spacing={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  State
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <StateChip state={task.status.state} />
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Updated
                </Typography>
                <Typography variant="body2">{fmt(task.status.timestamp)}</Typography>
              </Box>
              {task.contextId && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Context
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {task.contextId}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={`age ${fromNow(task.status.timestamp)}`} />
                {meaningfulHistory.length > 0 && (
                  <>
                    <Chip size="small" label={`history ${meaningfulHistory.length}`} />
                    <Chip size="small" label={`user ${userMsgs}`} />
                    <Chip size="small" label={`agent ${agentMsgs}`} />
                  </>
                )}
                {meaningfulArtifacts.length > 0 && (
                  <Chip size="small" label={`artifacts ${meaningfulArtifacts.length}`} />
                )}
              </Stack>
            </Stack>
          </Paper>

          {/* History (only if meaningful) */}
          {meaningfulHistory.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                History
              </Typography>
              <Stack spacing={1}>
                {meaningfulHistory.map((m, idx) => (
                  <Paper
                    key={m.messageId || idx}
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "background.default" }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Chip size="small" label={m.role} />
                      {m.messageId && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: "monospace" }}
                        >
                          {m.messageId}
                        </Typography>
                      )}
                    </Stack>
                    <Stack spacing={1}>{m.parts.map((p, i) => renderPart(p, i))}</Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Artifacts (only if meaningful) */}
          {meaningfulArtifacts.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Artifacts
              </Typography>
              <Stack spacing={1}>
                {meaningfulArtifacts.map((a) => (
                  <Paper key={a.artifactId} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2">{a.name ?? a.artifactId}</Typography>
                      <Chip size="small" label={`${a.parts.length} part(s)`} />
                    </Stack>
                    <Stack spacing={1}>{a.parts.map((p, i) => renderPart(p, i))}</Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}
        </Box>
      )}

      {/* Confirm dialog */}
      <Dialog
        open={confirmOpen}
        onClose={(_, __) => {
          if (!canceling) setConfirmOpen(false);
        }}
      >
        <DialogTitle>Cancel task?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            The task will be marked as <strong>canceled</strong>. This action is generally not
            reversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={canceling}>
            Cancel
          </Button>
          <Button
            onClick={confirmCancel}
            color="warning"
            variant="contained"
            startIcon={<DoDisturbOutlined />}
            disabled={canceling}
          >
            Cancel Task
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
