import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./layout/AppShell";
import DashboardPage from "./features/dashboard/DashboardPage";
import TasksPage from "./features/tasks/TasksPage";
import TaskDetailPage from "./features/tasks/TaskDetailPage";
import AgentsPage from "./features/agents/AgentsPage";
import PlaygroundPage from "./features/playground/PlaygroundPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
