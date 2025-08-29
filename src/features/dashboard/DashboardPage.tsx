import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTasks } from "../../services/a2a/restClient";
import type { Task } from "../../services/a2a/types";
import { Grid, Paper, Stack, Typography, Chip, Box, Divider, Button, Alert } from "@mui/material";
import { CheckCircleOutline, ErrorOutline, Autorenew, HelpOutline, Refresh } from "@mui/icons-material";
import { LineChart } from "@mui/x-charts";
import PageHeader from "../../components/PageHeader";
import { useAgents } from "../../context/AgentContext";

const Card = ({ children }: { children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>{children}</Paper>
);

export default function DashboardPage() {
  const { activeConn, activeId } = useAgents();

  if (!activeConn || !activeId) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Aktiviere einen Agent, um Daten zu sehen." />
        <Alert severity="info">Kein aktiver Agent. Füge im Tab „Agents“ einen REST‑fähigen Agent hinzu.</Alert>
      </>
    );
  }

  const { data: tasks = [], refetch, isFetching, error } = useQuery<Task[]>({
    queryKey: ["tasks-dashboard", activeId],
    queryFn: () => listTasks(activeConn),
  });

  const count = (s: string) => tasks.filter(t => t.status.state === s).length;
  const total = tasks.length;
  const completed = count("completed");
  const working = count("working");
  const inputReq = count("input-required");
  const failed = count("failed");

  const trendX = useMemo(() => Array.from({ length: 8 }, (_, i) => `T-${i + 1}`), []);
  const trendY = useMemo(() => Array.from({ length: 8 }, () => Math.floor(5 + Math.random() * 10)), []);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Live status of tasks and agents"
        actions={<Button size="small" startIcon={<Refresh />} onClick={() => refetch()} disabled={isFetching}>Refresh</Button>}
      />
      {error && <Alert severity="error" sx={{ mb:2 }}>{String((error as Error).message)}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutline color="success" /><Typography variant="subtitle2">Completed</Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{completed}</Typography>
              <Chip size="small" color="success" label={`${total ? Math.round((completed / total) * 100) : 0}%`} />
            </Stack>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Autorenew color="warning" /><Typography variant="subtitle2">Working</Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{working}</Typography>
              <Chip size="small" color="warning" label="active" />
            </Stack>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <HelpOutline color="info" /><Typography variant="subtitle2">Input required</Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{inputReq}</Typography>
              <Chip size="small" color="info" label="awaiting user" />
            </Stack>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ErrorOutline color="error" /><Typography variant="subtitle2">Failed</Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{failed}</Typography>
              <Chip size="small" color="error" label="errors" />
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <Typography variant="subtitle2" color="text.secondary">Tasks trend</Typography>
            <Box sx={{ height: 240, mt: 1 }}>
              <LineChart xAxis={[{ data: trendX, scaleType: "point" }]} series={[{ data: trendY }]} height={240} />
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <Typography variant="subtitle2" color="text.secondary">Recent tasks</Typography>
            <Divider sx={{ my: 1 }} />
            <Stack spacing={1}>
              {tasks.slice(0, 5).map(t => (
                <Stack key={t.id} direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{t.id}</Typography>
                  <Chip size="small" label={t.status.state} />
                </Stack>
              ))}
              {tasks.length === 0 && <Typography variant="body2" color="text.secondary">No data</Typography>}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
