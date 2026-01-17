import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import WorkspaceListPage from "@/features/workspaces/pages/WorkspaceListPage"
import WorkspacePage from "@/features/workspaces/pages/WorkspacePage"
import WorkspaceSettingsPage from "@/features/workspaces/pages/WorkspaceSettingsPage"
import AppSettingsPage from "@/features/settings/pages/AppSettingsPage"

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<WorkspaceListPage />} />
        <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
        <Route path="/workspaces/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
        <Route path="/settings" element={<AppSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
