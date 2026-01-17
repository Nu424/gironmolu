import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { nanoid } from "nanoid"
import type {
  WorkspaceId,
  NodeId,
  Workspace,
  TextNode,
  AppSettings,
} from "@/types/domain"
import { deleteNodeCascade } from "@/features/workspaces/domain/tree"
import { reorderSiblings } from "@/features/workspaces/domain/ordering"

type AddNodeInput =
  | (Omit<TextNode, "id" | "createdAt" | "updatedAt"> & {
      type: "question"
      question: string
      answer: string
      reconstructedText: string
      order?: number
    })
  | (Omit<TextNode, "id" | "createdAt" | "updatedAt"> & {
      type: "heading"
      title: string
      order?: number
    })
  | (Omit<TextNode, "id" | "createdAt" | "updatedAt"> & {
      type: "note"
      text: string
      order?: number
    })

type PersistState = {
  appSettings: AppSettings
  workspaceIds: WorkspaceId[]
  workspacesById: Record<WorkspaceId, Workspace>
  nodesById: Record<NodeId, TextNode>

  createWorkspace: (workspace: Omit<Workspace, "id" | "createdAt" | "updatedAt">) => WorkspaceId
  updateWorkspace: (partial: Partial<Workspace> & { id: WorkspaceId }) => void
  deleteWorkspace: (id: WorkspaceId) => void

  addNode: (node: AddNodeInput) => NodeId
  updateNode: (partial: Partial<TextNode> & { id: NodeId }) => void
  deleteNode: (id: NodeId) => void

  reorderSiblings: (params: {
    workspaceId: WorkspaceId
    parentId: NodeId | null
    orderedChildIds: NodeId[]
  }) => void
}

export const usePersistStore = create<PersistState>()(
  persist(
    (set, get) => ({
      appSettings: {
        openRouterApiKey: "",
        model: "openai/gpt-4o-mini",
      },
      workspaceIds: [],
      workspacesById: {},
      nodesById: {},

      createWorkspace: (workspace) => {
        const id = nanoid() as WorkspaceId
        const now = Date.now()
        const newWorkspace: Workspace = {
          ...workspace,
          id,
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({
          workspaceIds: [...state.workspaceIds, id],
          workspacesById: { ...state.workspacesById, [id]: newWorkspace },
        }))

        return id
      },

      updateWorkspace: (partial) => {
        const { id, ...rest } = partial
        set((state) => ({
          workspacesById: {
            ...state.workspacesById,
            [id]: {
              ...state.workspacesById[id],
              ...rest,
              updatedAt: Date.now(),
            },
          },
        }))
      },

      deleteWorkspace: (id) => {
        set((state) => {
          const nodesToDelete = Object.values(state.nodesById)
            .filter((n) => n.workspaceId === id)
            .map((n) => n.id)

          const newNodesById = { ...state.nodesById }
          nodesToDelete.forEach((nodeId) => {
            delete newNodesById[nodeId]
          })

          const newWorkspacesById = { ...state.workspacesById }
          delete newWorkspacesById[id]

          return {
            workspaceIds: state.workspaceIds.filter((wid) => wid !== id),
            workspacesById: newWorkspacesById,
            nodesById: newNodesById,
          }
        })
      },

      addNode: (nodeData) => {
        const id = nanoid() as NodeId
        const now = Date.now()
        const { workspaceId, parentId, order: inputOrder } = nodeData

        let order = inputOrder
        if (order === undefined) {
          const siblings = Object.values(get().nodesById).filter(
            (n) => n.workspaceId === workspaceId && n.parentId === parentId
          )
          order = siblings.length > 0 ? Math.max(...siblings.map((n) => n.order)) + 1 : 0
        }

        const newNode: TextNode =
          nodeData.type === "question"
            ? {
                id,
                workspaceId,
                parentId,
                type: "question",
                order,
                origin: "user",
                createdAt: now,
                updatedAt: now,
                question: nodeData.question,
                answer: nodeData.answer,
                reconstructedText: nodeData.reconstructedText,
              }
            : nodeData.type === "heading"
            ? {
                id,
                workspaceId,
                parentId,
                type: "heading",
                order,
                origin: "user",
                createdAt: now,
                updatedAt: now,
                title: nodeData.title,
              }
            : {
                id,
                workspaceId,
                parentId,
                type: "note",
                order,
                origin: "user",
                createdAt: now,
                updatedAt: now,
                text: nodeData.text,
              }

        set((state) => ({
          nodesById: { ...state.nodesById, [id]: newNode } as Record<NodeId, TextNode>,
        }))

        return id
      },

      updateNode: (partial) => {
        const { id, ...rest } = partial
        set((state) => ({
          nodesById: {
            ...state.nodesById,
            [id]: {
              ...state.nodesById[id],
              ...rest,
              updatedAt: Date.now(),
            } as TextNode,
          } as Record<NodeId, TextNode>,
        }))
      },

      deleteNode: (id) => {
        const state = get()
        const node = state.nodesById[id]
        if (!node) return

        const idsToDelete = deleteNodeCascade(state.nodesById, id)

        set((state) => {
          const newNodesById = { ...state.nodesById }
          idsToDelete.forEach((nodeId) => {
            delete newNodesById[nodeId]
          })
          return { nodesById: newNodesById }
        })
      },

      reorderSiblings: ({ workspaceId, parentId, orderedChildIds }) => {
        const state = get()
        const siblings = Object.values(state.nodesById).filter(
          (n) => n.workspaceId === workspaceId && n.parentId === parentId
        )

        const reordered = reorderSiblings(siblings, orderedChildIds)

        set((state) => {
          const newNodesById = { ...state.nodesById } as Record<NodeId, TextNode>
          reordered.forEach((n) => {
            newNodesById[n.id] = n
          })
          return { nodesById: newNodesById }
        })
      },
    }),
    {
      name: "gironomall:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
