import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getTask } from "../../services/a2a/restClient";
import { Box, Typography, Alert } from "@mui/material";
import type { Task } from "../../services/a2a/types";
import PageHeader from "../../components/PageHeader";
import { useAgents } from "../../context/AgentContext";

export default function TaskDetailPage(){
  const { id } = useParams();
  const { activeConn, activeId } = useAgents();

  if (!activeConn || !activeId) {
    return (
      <>
        <PageHeader title="Task" />
        <Alert severity="info">Kein aktiver Agent.</Alert>
      </>
    );
  }

  const { data, error, isLoading } = useQuery<Task>({
    queryKey:["task", activeId, id],
    queryFn:()=>getTask(activeConn, id!),
    enabled:!!id
  });
  if(error) return <Alert severity="error">{String((error as Error).message)}</Alert>;
  if(isLoading || !data) return null;

  return (
    <Box>
      <Typography variant="h6">Task {data.id}</Typography>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </Box>
  );
}
