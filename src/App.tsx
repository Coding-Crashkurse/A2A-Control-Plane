import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./layout/AppShell";
import AgentsPage from "./features/agents/AgentsPage";
import TasksPage from "./features/tasks/TasksPage";
import TaskDetailPage from "./features/tasks/TaskDetailPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import { AgentProvider } from "./context/AgentContext";

export default function App() {
  return (
    <AgentProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppShell>
    </AgentProvider>
  );
}
