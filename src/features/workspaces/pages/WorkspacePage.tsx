import { useParams, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { usePersistStore } from "@/stores/persistStore"
import { useUIStore } from "@/stores/uiStore"
import { buildTree } from "@/features/workspaces/domain/tree"
import TreeView from "../components/TreeView"
import { Toast } from "@/components/Toast"
import { Plus } from "lucide-react"
import { toUserFriendlyError } from "@/lib/llm/api"
import type { WorkspaceId, NodeType, NodeId } from "@/types/domain"

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const { workspacesById, nodesById, addNode, appSettings, generateFollowupQuestionsForWorkspace } = usePersistStore()
  const { rootBusyByWorkspace, setRootBusy, showToast, setExpanded, setExpandedMany, flashHighlight, expanded } = useUIStore()

  const nodes = Object.values(nodesById).filter((n) => n.workspaceId === workspaceId)
  const tree = buildTree(nodes)
  const nodeIds = nodes.map((node) => node.id as NodeId)

  useEffect(() => {
    if (tree.length === 0) return

    tree.forEach((node) => {
      if (expanded[node.id] === undefined) {
        setExpanded(node.id as NodeId, true)
      }
    })
  }, [expanded, setExpanded, tree])

  const workspace = workspaceId ? workspacesById[workspaceId as WorkspaceId] : undefined
  const hasApiKey = appSettings.openRouterApiKey.trim().length > 0

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

  const handleGenerateFollowupQuestions = async () => {
    if (!workspaceId) return

    if (!hasApiKey) {
      showToast("error", "APIキーが設定されていません。アプリ設定で設定してください")
      return
    }

    setRootBusy(workspaceId as WorkspaceId, true)

    try {
      const result = await generateFollowupQuestionsForWorkspace(workspaceId as WorkspaceId)
      result.expandIds.forEach((expandId) => {
        setExpanded(expandId as NodeId, true)
      })
      flashHighlight(result.nodeIds as NodeId[], 3000)
      showToast("info", `${result.nodeIds.length}個の質問を追加しました`)
    } catch (err) {
      const message = toUserFriendlyError(err)
      showToast("error", message)
    } finally {
      setRootBusy(workspaceId as WorkspaceId, false)
    }
  }

  const handleExpandAll = () => {
    setExpandedMany(nodeIds, true)
  }

  const handleCollapseAll = () => {
    setExpandedMany(nodeIds, false)
  }

  const isGenerating = rootBusyByWorkspace[workspaceId as WorkspaceId]

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/")}
                className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"
              >
                一覧へ戻る
              </button>
              <button
                onClick={() => navigate(`/workspaces/${workspaceId}/settings`)}
                className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"
              >
                設定
              </button>
            </div>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={handleGenerateFollowupQuestions}
            disabled={isGenerating || !hasApiKey}
            className="px-3 py-1.5 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isGenerating ? "生成中..." : "追加質問生成（LLM）"}
          </button>
          <button
            onClick={handleExpandAll}
            disabled={nodeIds.length === 0}
            className="px-3 py-1.5 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            すべて展開
          </button>
          <button
            onClick={handleCollapseAll}
            disabled={nodeIds.length === 0}
            className="px-3 py-1.5 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            すべて折りたたむ
          </button>
          {!hasApiKey && (
            <button
              onClick={() => navigate("/settings")}
              className="text-xs text-blue-600 hover:underline"
            >
              APIキーを設定する
            </button>
          )}
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

