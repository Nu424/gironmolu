import { create } from "zustand"
import type { NodeId, WorkspaceId, NodeBusy } from "@/types/domain"

type Toast = {
  kind: "error" | "info"
  message: string
}

type UIState = {
  creatingWorkspace: boolean
  nodeBusy: Record<NodeId, NodeBusy | undefined>
  rootBusyByWorkspace: Record<WorkspaceId, boolean>
  toast: Toast | null
  expanded: Record<NodeId, boolean>

  setCreatingWorkspace: (value: boolean) => void
  setNodeBusy: (nodeId: NodeId, status: NodeBusy | undefined) => void
  setRootBusy: (workspaceId: WorkspaceId, status: boolean) => void
  showToast: (kind: Toast["kind"], message: string) => void
  clearToast: () => void
  toggleExpanded: (nodeId: NodeId) => void
  setExpanded: (nodeId: NodeId, value: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  creatingWorkspace: false,
  nodeBusy: {},
  rootBusyByWorkspace: {},
  toast: null,
  expanded: {},

  setCreatingWorkspace: (value) => set({ creatingWorkspace: value }),

  setNodeBusy: (nodeId, status) =>
    set((state) => ({
      nodeBusy: { ...state.nodeBusy, [nodeId]: status },
    })),

  setRootBusy: (workspaceId, status) =>
    set((state) => ({
      rootBusyByWorkspace: { ...state.rootBusyByWorkspace, [workspaceId]: status },
    })),

  showToast: (kind, message) => set({ toast: { kind, message } }),

  clearToast: () => set({ toast: null }),

  toggleExpanded: (nodeId) =>
    set((state) => ({
      expanded: { ...state.expanded, [nodeId]: !state.expanded[nodeId] },
    })),

  setExpanded: (nodeId, value) =>
    set((state) => ({
      expanded: { ...state.expanded, [nodeId]: value },
    })),
}))
