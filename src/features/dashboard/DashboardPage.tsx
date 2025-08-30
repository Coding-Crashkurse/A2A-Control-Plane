// src/features/dashboard/DashboardPage.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTasks } from "../../services/a2a/restClient";
import type { Task } from "../../services/a2a/types";
import {
  Grid,
  Paper,
  Stack,
  Typography,
  Chip,
  Box,
  Divider,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import {
  CheckCircleOutline,
  ErrorOutline,
  Autorenew,
  HelpOutline,
  Refresh,
  HourglassEmpty,
  LockOutlined,
  Block,
  DoDisturbOutlined,
} from "@mui/icons-material";
import { BarChart } from "@mui/x-charts";
import PageHeader from "../../components/PageHeader";
import { useAgents } from "../../context/AgentContext";
import EmptyState, { Steps } from "../../components/EmptyState";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

// --- card helper ---
const Card = ({ children }: { children: React.ReactNode }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      borderRadius: 2,
      boxShadow: 1,
      transition: "box-shadow .2s ease, transform .2s ease",
      "&:hover": { boxShadow: 4, transform: "translateY(-2px)" },
      height: "100%",
    }}
  >
    {children}
  </Paper>
);

function KpiCard({
  icon,
  title,
  value,
  chipColor,
  chipLabel,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  chipColor?: "default" | "success" | "warning" | "info" | "error";
  chipLabel?: string;
}) {
  return (
    <Card>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Typography variant="subtitle2">{title}</Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {chipLabel && <Chip size="small" color={chipColor} label={chipLabel} />}
      </Stack>
    </Card>
  );
}

// ---- helpers ----
function parseTs(ts: unknown): number | null {
  if (ts == null) return null;
  const n = Number(ts);
  if (!Number.isNaN(n) && n > 0) {
    const ms = n > 1e12 ? n : n * 1000;
    const d = dayjs(ms);
    return d.isValid() ? d.valueOf() : null;
  }
  if (typeof ts === "string") {
    const d = dayjs(ts);
    if (d.isValid()) return d.valueOf();
    const d2 = dayjs(new Date(ts));
    if (d2.isValid()) return d2.valueOf();
  }
  return null;
}

function quantile(values: number[], q: number) {
  if (values.length === 0) return null;
  const arr = [...values].sort((a, b) => a - b);
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return arr[base + 1] !== undefined
    ? arr[base] + rest * (arr[base + 1] - arr[base])
    : arr[base];
}

function fmtDuration(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 1) return "<1m";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function shortId(id: string, head = 6, tail = 4) {
  return id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

export default function DashboardPage() {
  const { activeConn, activeId } = useAgents();
  const navigate = useNavigate();

  if (!activeConn || !activeId) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Activate an agent to see data." />
        <EmptyState
          title="No active agent yet"
          subtitle="Add a REST-capable A2A agent. After that you’ll see live tasks and KPIs."
          actions={<Button onClick={() => navigate("/agents")}>Go to “Agents”</Button>}
        >
          <Steps />
        </EmptyState>
      </>
    );
  }

  const { data: tasks = [], refetch, isFetching, error } = useQuery<Task[]>({
    queryKey: ["tasks-dashboard", activeId],
    queryFn: () => listTasks(activeConn),
  });

  // counts per state
  const byState = tasks.reduce<Record<string, number>>((acc, t) => {
    const s = t.status.state;
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const total = tasks.length;

  const completedNow = byState["completed"] || 0;
  const workingNow = byState["working"] || 0;
  const inputReqNow = byState["input-required"] || 0;
  const submittedNow = byState["submitted"] || 0;
  const authReqNow = byState["auth-required"] || 0;
  const failedNow = byState["failed"] || 0;
  const rejectedNow = byState["rejected"] || 0;
  const canceledNow = byState["canceled"] || 0;
  const unknownNow = byState["unknown"] || 0;

  // ---------- metrics based on timestamps ----------
  const now = dayjs();
  const last24 = now.subtract(24, "hour").valueOf();

  let completed24h = 0;
  let failed24h = 0;
  const wipAgesMin: number[] = [];

  for (const t of tasks) {
    const ts = parseTs(t.status?.timestamp);
    if (ts == null) continue;

    if (ts >= last24) {
      if (t.status.state === "completed") completed24h++;
      if (t.status.state === "failed") failed24h++;
    }
    if (["working", "input-required", "submitted", "auth-required"].includes(t.status.state as string)) {
      const mins = (dayjs().valueOf() - ts) / 60000;
      if (mins >= 0) wipAgesMin.push(mins);
    }
  }

  const successRate24h =
    completed24h + failed24h > 0
      ? Math.round((completed24h / (completed24h + failed24h)) * 100)
      : null;

  const p50 = quantile(wipAgesMin, 0.5);
  const p95 = quantile(wipAgesMin, 0.95);

  // Buckets: last 8 hours, recalculated every render; no mutation between renders
  const { trendX, trendY } = useMemo(() => {
    const edges: { start: number; end: number; label: string }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = dayjs().subtract(i, "hour").startOf("hour").valueOf();
      const end = dayjs().subtract(i, "hour").endOf("hour").valueOf();
      edges.push({ start, end, label: dayjs(start).format("HH:00") });
    }
    const counts = edges.map(() => 0);

    for (const t of tasks) {
      if (t.status.state !== "completed") continue;
      const ts = parseTs(t.status.timestamp);
      if (ts == null) continue;
      const idx = edges.findIndex((b) => ts >= b.start && ts <= b.end);
      if (idx !== -1) counts[idx] += 1;
    }
    return { trendX: edges.map((e) => e.label), trendY: counts };
  }, [tasks, activeId]);

  // recent list: sort by timestamp desc
  const recent = [...tasks]
    .sort((a, b) => (parseTs(b.status.timestamp) ?? 0) - (parseTs(a.status.timestamp) ?? 0))
    .slice(0, 12);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Live status of tasks and agents"
        actions={
          <Button size="small" startIcon={<Refresh />} onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </Button>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{String((error as Error).message)}</Alert>}

      <Grid container spacing={2} alignItems="stretch">
        {/* Row 1 */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            icon={<CheckCircleOutline color="success" />}
            title="Completed"
            value={completedNow}
            chipColor="success"
            chipLabel={`${total ? Math.round((completedNow / total) * 100) : 0}%`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            icon={<Autorenew color="warning" />}
            title="Working"
            value={workingNow}
            chipColor="warning"
            chipLabel="active"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            icon={<HelpOutline color="info" />}
            title="Input required"
            value={inputReqNow}
            chipColor="info"
            chipLabel="awaiting user"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            icon={<ErrorOutline color="error" />}
            title="Failed"
            value={failedNow}
            chipColor="error"
            chipLabel="errors"
          />
        </Grid>

        {/* Row 2 */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            icon={<HourglassEmpty color="info" />}
            title="Submitted"
            value={submittedNow}
            chipColor="info"
            chipLabel="submitted"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            icon={<LockOutlined color="info" />}
            title="Auth required"
            value={authReqNow}
            chipColor="info"
            chipLabel="auth-required"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            icon={<Block color="error" />}
            title="Rejected"
            value={rejectedNow}
            chipColor="error"
            chipLabel="rejected"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard icon={<DoDisturbOutlined />} title="Canceled" value={canceledNow} chipLabel="canceled" />
        </Grid>

        {/* Row 3 (only if present) */}
        {unknownNow > 0 && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard icon={<HelpOutline />} title="Unknown" value={unknownNow} chipLabel="unknown" />
          </Grid>
        )}

        {/* Trend */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Completions per hour (last 8h)
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" icon={<CheckCircleOutline />} label={`24h completions: ${completed24h}`} />
                <Chip
                  size="small"
                  icon={<ErrorOutline />}
                  color={successRate24h != null ? "success" : "default"}
                  label={successRate24h != null ? `24h success: ${successRate24h}%` : "24h success: n/a"}
                />
                <Chip size="small" icon={<Autorenew />} label={`WIP age P50: ${fmtDuration(p50 ?? null)}`} />
                <Chip size="small" icon={<Autorenew />} label={`WIP age P95: ${fmtDuration(p95 ?? null)}`} />
              </Stack>

              <Box sx={{ height: 260, mt: 1 }}>
                <BarChart
                  xAxis={[{ data: trendX, scaleType: "band" }]}
                  series={[{ data: trendY }]}
                  height={260}
                />
              </Box>

              <Typography variant="caption" color="text.secondary">
                Note: Times are based on the task’s <code>status.timestamp</code>.
              </Typography>
            </Stack>
          </Card>
        </Grid>

        {/* Recent tasks with scroll */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <Typography variant="subtitle2" color="text.secondary">
              Recent tasks
            </Typography>
            <Divider sx={{ my: 1 }} />
            <List
              dense
              sx={{
                maxHeight: 290,
                overflowY: "auto",
                pr: 1,
                "& .MuiListItem-root": { borderRadius: 1, px: 1 },
                "& .MuiListItem-root:hover": { bgcolor: "action.hover" },
              }}
            >
              {recent.map((t) => {
                const ts = parseTs(t.status.timestamp);
                const tsLabel = ts ? dayjs(ts).format("YYYY-MM-DD HH:mm") : "—";
                return (
                  <ListItem key={t.id} disableGutters secondaryAction={<Chip size="small" label={t.status.state} />}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                          {shortId(t.id)}
                        </Typography>
                      }
                      secondary={<Typography variant="caption">{tsLabel}</Typography>}
                    />
                  </ListItem>
                );
              })}
              {recent.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                  No data
                </Typography>
              )}
            </List>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
