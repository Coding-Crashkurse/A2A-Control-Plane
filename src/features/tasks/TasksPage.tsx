import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTasks } from "../../services/a2a/restClient";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import {
  Paper,
  Chip,
  Stack,
  Button,
  TextField,
  MenuItem,
  Checkbox,
  ListItemText,
} from "@mui/material";
import {
  CheckCircleOutline,
  Autorenew,
  HelpOutline,
  ErrorOutline,
  DoDisturbOutlined,
  HourglassEmpty,
  LockOutlined,
  Block,
  FilterAlt,
  Clear,
} from "@mui/icons-material";
import type { Task, TaskState } from "../../services/a2a/types";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader";
import { useAgents } from "../../context/AgentContext";

const STATUS_OPTIONS: TaskState[] = [
  "completed",
  "working",
  "submitted",
  "input-required",
  "auth-required",
  "failed",
  "rejected",
  "canceled",
  "unknown",
];

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

function formatTs(ts: unknown): string {
  if (ts == null) return "—";
  const n = Number(ts);
  if (!Number.isNaN(n) && n > 0) {
    const ms = n > 1e12 ? n : n * 1000;
    return dayjs(ms).format("YYYY-MM-DD HH:mm:ss");
  }
  if (typeof ts === "string") {
    const d = dayjs(ts);
    if (d.isValid()) return d.format("YYYY-MM-DD HH:mm:ss");
    const d2 = dayjs(new Date(ts));
    if (d2.isValid()) return d2.format("YYYY-MM-DD HH:mm:ss");
  }
  return "—";
}

const cols: GridColDef<Task>[] = [
  { field: "id", headerName: "Task ID", flex: 1, minWidth: 180 },
  {
    field: "state",
    headerName: "State",
    width: 170,
    sortable: false,
    renderCell: ({ row }) => <StateChip state={row.status.state} />,
  },
  {
    field: "updated",
    headerName: "Updated",
    width: 210,
    sortable: false,
    renderCell: ({ row }) => formatTs(row.status?.timestamp as unknown),
  },
  { field: "contextId", headerName: "Context", flex: 1, minWidth: 180 },
];

export default function TasksPage() {
  const { activeConn, activeId } = useAgents();
  const navigate = useNavigate();
  const [selectedStates, setSelectedStates] = useState<TaskState[]>([]);

  if (!activeConn || !activeId) {
    return <PageHeader title="Tasks" subtitle="Please add and activate an agent." />;
  }

  const { data = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", activeId],
    queryFn: () => listTasks(activeConn),
  });

  const rows = useMemo(
    () =>
      selectedStates.length === 0
        ? data
        : data.filter((t) => selectedStates.includes(t.status.state)),
    [data, selectedStates]
  );

  const headerActions = (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        select
        size="small"
        label="Filter status"
        value={selectedStates}
        onChange={(e) => {
          const v = e.target.value as unknown as TaskState[] | string[];
          setSelectedStates(v as TaskState[]);
        }}
        SelectProps={{
          multiple: true,
          renderValue: (selected) => (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {(selected as TaskState[]).map((s) => (
                <StateChip key={s} state={s} />
              ))}
            </Stack>
          ),
        }}
        sx={{ minWidth: 280 }}
      >
        {STATUS_OPTIONS.map((s) => (
          <MenuItem key={s} value={s}>
            <Checkbox checked={selectedStates.indexOf(s) > -1} />
            <ListItemText primary={s} />
          </MenuItem>
        ))}
      </TextField>
      <Button
        size="small"
        variant="outlined"
        startIcon={<FilterAlt />}
        onClick={() => setSelectedStates(STATUS_OPTIONS)}
      >
        All
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<Clear />}
        onClick={() => setSelectedStates([])}
      >
        Clear
      </Button>
    </Stack>
  );

  return (
    <>
      <PageHeader title="Tasks" subtitle="Live tasks of the active agent" actions={headerActions} />
      <Paper
        variant="outlined"
        sx={{
          height: 560,
          p: 1,
          borderRadius: 2,
          boxShadow: 1,
          transition: "box-shadow .2s ease, transform .2s ease",
          "&:hover": { boxShadow: 4, transform: "translateY(-2px)" },
        }}
      >
        <DataGrid<Task>
          rows={rows}
          columns={cols}
          getRowId={(r) => r.id}
          loading={isLoading}
          density="compact"
          pageSizeOptions={[25, 50, 100]}
          disableColumnMenu
          disableRowSelectionOnClick
          onRowClick={(p) => navigate(`/tasks/${p.row.id}`)}
          sx={{
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "action.hover" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
          }}
        />
      </Paper>
    </>
  );
}
