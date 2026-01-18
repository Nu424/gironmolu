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
import {
  importWorkspaceFromExport,
  parseWorkspaceExport,
  serializeWorkspaceExport,
} from "@/features/workspaces/domain/workspaceTransfer"
import {
  generateInitialTree,
  generateFollowupQuestions,
  generateReconstructedText,
  toUserFriendlyError,
} from "@/lib/llm/api"
import { formatGuidelines, workspaceToMarkdownForLLM } from "@/features/workspaces/domain/markdown"
import type { InitialTreeNode } from "@/features/workspaces/domain/tree"

type AddNodeInput =
  | ({
      type: "question"
      workspaceId: WorkspaceId
      parentId: NodeId | null
      question: string
      answer: string
      reconstructedText: string
      order?: number
      origin?: "user" | "llm"
    })
  | ({
      type: "heading"
      workspaceId: WorkspaceId
      parentId: NodeId | null
      title: string
      order?: number
      origin?: "user" | "llm"
    })
  | ({
      type: "note"
      workspaceId: WorkspaceId
      parentId: NodeId | null
      text: string
      order?: number
      origin?: "user" | "llm"
    })

type PersistState = {
  appSettings: AppSettings
  workspaceIds: WorkspaceId[]
  workspacesById: Record<WorkspaceId, Workspace>
  nodesById: Record<NodeId, TextNode>

  createWorkspace: (workspace: Omit<Workspace, "id" | "createdAt" | "updatedAt">) => WorkspaceId
  createWorkspaceWithLLM: (
    theme: string,
    description: string | undefined
  ) => Promise<{ workspaceId: WorkspaceId; error?: string }>
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

  exportWorkspaceToJson: (workspaceId: WorkspaceId) => string
  importWorkspaceFromJson: (jsonText: string) => { workspaceId: WorkspaceId; nodeCount: number }

  generateFollowupQuestionsForWorkspace: (
    workspaceId: WorkspaceId,
    originNodeId?: NodeId
  ) => Promise<{ nodeIds: NodeId[]; expandIds: NodeId[] }>

  testConnection: (params: {
    apiKey: string
    model: string
  }) => Promise<{ success: boolean; error?: string }>

  updateAppSettings: (partial: Partial<AppSettings>) => void
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

      createWorkspaceWithLLM: async (theme, description) => {
        const { appSettings, createWorkspace, addNode } = get()

        if (!appSettings.openRouterApiKey.trim()) {
          return { workspaceId: "" as WorkspaceId, error: "APIキーが設定されていません" }
        }

        try {
          const result = await generateInitialTree(
            theme,
            description,
            appSettings.openRouterApiKey,
            appSettings.model
          )

          const createdWorkspaceId = createWorkspace({
            theme: theme.trim(),
            description: description?.trim() || undefined,
            guidelineText: formatGuidelines(result.guidelines),
            config: { followupCount: 3 },
          })

          function addNodesRecursive(
            tree: InitialTreeNode[],
            parentId: NodeId | null,
            order: number
          ) {
            tree.forEach((node, index) => {
              const nodeOrder = order + index

              let nodeId: NodeId
              if (node.type === "heading") {
                nodeId = addNode({
                  workspaceId: createdWorkspaceId,
                  parentId,
                  type: "heading",
                  title: node.title ?? "",
                  order: nodeOrder,
                  origin: "llm",
                })
              } else if (node.type === "question") {
                nodeId = addNode({
                  workspaceId: createdWorkspaceId,
                  parentId,
                  type: "question",
                  question: node.question ?? "",
                  answer: "",
                  reconstructedText: "",
                  order: nodeOrder,
                  origin: "llm",
                })
              } else {
                nodeId = addNode({
                  workspaceId: createdWorkspaceId,
                  parentId,
                  type: "note",
                  text: node.text ?? "",
                  order: nodeOrder,
                  origin: "llm",
                })
              }

              if (node.children && node.children.length > 0) {
                addNodesRecursive(node.children, nodeId, 0)
              }
            })
          }

          addNodesRecursive(result.tree, null, 0)

          return { workspaceId: createdWorkspaceId }
        } catch (err) {
          return { workspaceId: "" as WorkspaceId, error: toUserFriendlyError(err) }
        }
      },

      generateFollowupQuestionsForWorkspace: async (workspaceId, originNodeId) => {
        const { appSettings, workspacesById, nodesById, addNode } = get()

        if (!appSettings.openRouterApiKey.trim()) {
          throw new Error("APIキーが設定されていません")
        }

        const workspace = workspacesById[workspaceId]
        if (!workspace) {
          throw new Error("ワークスペースが見つかりません")
        }

        const workspaceNodes = Object.values(nodesById).filter(
          (n) => n.workspaceId === workspaceId
        )
        const markdown = workspaceToMarkdownForLLM(workspace, workspaceNodes)

        const result = await generateFollowupQuestions(
          workspace.theme,
          workspace.description,
          workspace.guidelineText,
          markdown,
          workspace.config.followupCount,
          appSettings.openRouterApiKey,
          appSettings.model,
          originNodeId
        )

        const addedNodeIds: NodeId[] = []
        const expandIdSet = new Set<NodeId>()

        const collectExpandIds = (startId: NodeId | null) => {
          let current = startId
          while (current) {
            if (expandIdSet.has(current)) break
            expandIdSet.add(current)
            current = nodesById[current]?.parentId ?? null
          }
        }

        for (const q of result.newQuestions) {
          let parentId: NodeId | null = null

          const trimmedParentId = q.parentId?.trim()

          if (trimmedParentId && trimmedParentId !== "null") {
            if (trimmedParentId.startsWith("[") && trimmedParentId.endsWith("]")) {
              const withoutBrackets = trimmedParentId.slice(1, -1)
              const parentNode = nodesById[withoutBrackets as NodeId]
              if (parentNode && parentNode.workspaceId === workspaceId) {
                parentId = parentNode.id
              }
            } else {
              const parentNode = nodesById[trimmedParentId as NodeId]
              if (parentNode && parentNode.workspaceId === workspaceId) {
                parentId = parentNode.id
              }
            }
          }

          if (!parentId && originNodeId) {
            const originNode = nodesById[originNodeId]
            if (originNode && originNode.workspaceId === workspaceId) {
              parentId = originNode.id
            }
          }

          const nodeId = addNode({
            workspaceId,
            parentId,
            type: "question",
            question: q.question,
            answer: "",
            reconstructedText: "",
            origin: "llm",
          })

          addedNodeIds.push(nodeId)
          if (parentId) {
            collectExpandIds(parentId)
          }
        }

        return { nodeIds: addedNodeIds, expandIds: Array.from(expandIdSet) }
      },

      testConnection: async ({ apiKey, model }) => {
        if (!apiKey.trim()) {
          return { success: false, error: "APIキーが設定されていません" }
        }

        try {
          await generateReconstructedText(
            "接続テスト",
            "接続テスト",
            apiKey,
            model
          )
          return { success: true }
        } catch (err) {
          return { success: false, error: toUserFriendlyError(err) }
        }
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
                origin: nodeData.origin ?? "user",
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
                origin: nodeData.origin ?? "user",
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
                origin: nodeData.origin ?? "user",
                createdAt: now,
                updatedAt: now,
                text: nodeData.text,
              }

        set((state) => ({
          nodesById: { ...state.nodesById, [id]: newNode } as Record<NodeId, TextNode>,
          workspacesById: {
            ...state.workspacesById,
            [workspaceId]: {
              ...state.workspacesById[workspaceId],
              updatedAt: Date.now(),
            },
          },
        }))

        return id
      },

      updateNode: (partial) => {
        const { id, ...rest } = partial
        const node = get().nodesById[id]
        if (!node) return

        set((state) => ({
          nodesById: {
            ...state.nodesById,
            [id]: {
              ...state.nodesById[id],
              ...rest,
              updatedAt: Date.now(),
            } as TextNode,
          } as Record<NodeId, TextNode>,
          workspacesById: {
            ...state.workspacesById,
            [node.workspaceId]: {
              ...state.workspacesById[node.workspaceId],
              updatedAt: Date.now(),
            },
          },
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

          return {
            nodesById: newNodesById,
            workspacesById: {
              ...state.workspacesById,
              [node.workspaceId]: {
                ...state.workspacesById[node.workspaceId],
                updatedAt: Date.now(),
              },
            },
          }
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
          return {
            nodesById: newNodesById,
            workspacesById: {
              ...state.workspacesById,
              [workspaceId]: {
                ...state.workspacesById[workspaceId],
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      exportWorkspaceToJson: (workspaceId) => {
        const { workspacesById, nodesById } = get()
        const workspace = workspacesById[workspaceId]
        if (!workspace) {
          throw new Error("ワークスペースが見つかりません")
        }
        const nodes = Object.values(nodesById).filter((n) => n.workspaceId === workspaceId)
        return serializeWorkspaceExport(workspace, nodes)
      },

      importWorkspaceFromJson: (jsonText) => {
        const parsed = parseWorkspaceExport(jsonText)
        const newWorkspaceId = nanoid() as WorkspaceId
        const { workspace, nodes } = importWorkspaceFromExport(parsed, newWorkspaceId, () => nanoid() as NodeId)

        set((state) => {
          const newNodesById = { ...state.nodesById }
          nodes.forEach((node) => {
            newNodesById[node.id] = node
          })

          return {
            workspaceIds: [...state.workspaceIds, workspace.id],
            workspacesById: { ...state.workspacesById, [workspace.id]: workspace },
            nodesById: newNodesById,
          }
        })

        return { workspaceId: newWorkspaceId, nodeCount: nodes.length }
      },

      updateAppSettings: (partial) => {
        set((state) => ({
          appSettings: { ...state.appSettings, ...partial },
        }))
      },
    }),
    {
      name: "gironomall:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
