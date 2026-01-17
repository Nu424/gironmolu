import { useParams, useNavigate } from "react-router-dom"
import { usePersistStore } from "@/stores/persistStore"
import { buildTree } from "@/features/workspaces/domain/tree"
import TreeView from "../components/TreeView"
import { Toast } from "@/components/Toast"
import { Plus } from "lucide-react"
import type { WorkspaceId, NodeType } from "@/types/domain"

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const { workspacesById, nodesById, addNode } = usePersistStore()

  const workspace = workspaceId ? workspacesById[workspaceId as WorkspaceId] : undefined

  if (!workspace) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 text-center">
        <p className="text-gray-600">ワークスペースが見つかりません</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 text-blue-600 hover:underline"
        >
          トップに戻る
        </button>
      </div>
    )
  }

  const nodes = Object.values(nodesById).filter((n) => n.workspaceId === workspaceId)
  const tree = buildTree(nodes)

  const handleAddRootNode = (type: NodeType) => {
    if (!workspaceId) return

    if (type === "question") {
      addNode({
        workspaceId: workspaceId as WorkspaceId,
        parentId: null,
        type: "question",
        question: "",
        answer: "",
        reconstructedText: "",
      })
    } else if (type === "note") {
      addNode({
        workspaceId: workspaceId as WorkspaceId,
        parentId: null,
        type: "note",
        text: "",
      })
    } else {
      addNode({
        workspaceId: workspaceId as WorkspaceId,
        parentId: null,
        type: "heading",
        title: "",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <Toast />

      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{workspace.theme}</h1>
              {workspace.description && (
                <p className="text-gray-600">{workspace.description}</p>
              )}
            </div>
            <button
              onClick={() => navigate(`/workspaces/${workspaceId}/settings`)}
              className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"
            >
              設定
            </button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            disabled
            title="追加質問生成（Phase 9で実装予定）"
            className="px-3 py-1.5 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            追加質問生成（LLM）
          </button>
          <label className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm">
            <Plus size={16} />
            ルートに追加
            <select
              className="bg-blue-600 text-white border-l border-white/40 pl-2"
              onChange={(e) => {
                const value = e.target.value as NodeType
                if (!value) return
                handleAddRootNode(value)
                e.currentTarget.selectedIndex = 0
              }}
            >
              <option value="">種類</option>
              <option value="question">質問</option>
              <option value="note">メモ</option>
              <option value="heading">見出し</option>
            </select>
          </label>
        </div>

        <TreeView
          nodes={tree}
          workspaceId={workspaceId as WorkspaceId}
          parentId={null}
          depth={0}
        />
      </div>
    </div>
  )
}
