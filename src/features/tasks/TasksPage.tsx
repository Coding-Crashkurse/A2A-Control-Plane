import { useQuery } from "@tanstack/react-query";
import { listTasks } from "../../services/a2a/restClient";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { Box, Chip, Alert } from "@mui/material";
import {
  CheckCircleOutline, Autorenew, HelpOutline, ErrorOutline, DoDisturbOutlined, HourglassEmpty,
} from "@mui/icons-material";
import type { Task, TaskState } from "../../services/a2a/types";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader";
import { useAgents } from "../../context/AgentContext";

function StateChip({ state }: { state: TaskState }) {
  switch (state) {
    case "completed": return <Chip size="small" color="success" icon={<CheckCircleOutline fontSize="small" />} label="completed" />;
    case "working": return <Chip size="small" color="warning" icon={<Autorenew fontSize="small" />} label="working" />;
    case "submitted": return <Chip size="small" color="info" icon={<HourglassEmpty fontSize="small" />} label="submitted" />;
    case "input-required": return <Chip size="small" color="info" icon={<HelpOutline fontSize="small" />} label="input-required" />;
    case "failed": return <Chip size="small" color="error" icon={<ErrorOutline fontSize="small" />} label="failed" />;
    case "canceled":
    default: return <Chip size="small" icon={<DoDisturbOutlined fontSize="small" />} label="canceled" />;
  }
}

const cols: GridColDef<Task>[] = [
  { field: "id", headerName: "Task ID", flex: 1, minWidth: 180 },
  { field: "state", headerName: "State", width: 170, sortable: false, renderCell: ({ row }) => <StateChip state={row.status.state} /> },
  { field: "updated", headerName: "Updated", width: 200, valueGetter: (_v, row) => row.status.timestamp, renderCell: ({ row }) => dayjs(row.status.timestamp).format("YYYY-MM-DD HH:mm:ss") },
  { field: "contextId", headerName: "Context", flex: 1, minWidth: 180 },
];

export default function TasksPage() {
  const { activeConn, activeId } = useAgents();
  const navigate = useNavigate();

  if (!activeConn || !activeId) {
    return (
      <>
        <PageHeader title="Tasks" subtitle="Bitte einen Agent hinzufügen und aktivieren." />
        <Alert severity="info">Kein aktiver Agent. Gehe zu „Agents“ und füge einen REST‑fähigen Agent hinzu.</Alert>
      </>
    );
  }

  const { data = [], isLoading, error } = useQuery<Task[]>({
    queryKey: ["tasks", activeId],
    queryFn: () => listTasks(activeConn),
  });

  return (
    <>
      <PageHeader title="Tasks" subtitle="Live tasks des aktiven Agents" />
      {error && <Alert severity="error" sx={{ mb:1 }}>{String((error as Error).message)}</Alert>}
      <Box sx={{ height: 560 }}>
        <DataGrid<Task>
          rows={data}
          columns={cols}
          getRowId={(r) => r.id}
          loading={isLoading}
          density="compact"
          pageSizeOptions={[25, 50, 100]}
          disableColumnMenu
          disableRowSelectionOnClick
          onRowClick={(p) => navigate(`/tasks/${p.row.id}`)}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "action.hover" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
          }}
        />
      </Box>
    </>
  );
}
