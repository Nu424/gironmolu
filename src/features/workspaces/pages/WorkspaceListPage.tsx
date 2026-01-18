import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { usePersistStore } from "@/stores/persistStore"
import { useUIStore } from "@/stores/uiStore"
import { Modal } from "@/components/Modal"
import { Toast } from "@/components/Toast"
import type { QuestionNode as TQuestionNode, TextNode } from "@/types/domain"

function isQuestionNode(node: TextNode): node is TQuestionNode {
  return node.type === "question"
}

export default function WorkspaceListPage() {
  const navigate = useNavigate()
  const {
    workspaceIds,
    workspacesById,
    createWorkspaceWithLLM,
    deleteWorkspace,
    nodesById,
    appSettings,
  } = usePersistStore()
  const { creatingWorkspace, setCreatingWorkspace, showToast } = useUIStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [theme, setTheme] = useState("")
  const [description, setDescription] = useState("")

  const handleCreate = async () => {
    if (!theme.trim()) {
      showToast("error", "テーマは必須です")
      return
    }

    if (!appSettings.openRouterApiKey.trim()) {
      showToast("error", "APIキーが設定されていません。アプリ設定で設定してください")
      return
    }

    setCreatingWorkspace(true)

    try {
      const result = await createWorkspaceWithLLM(
        theme.trim(),
        description.trim() || undefined
      )

      if (result.error) {
        showToast("error", result.error)
        return
      }

      setIsModalOpen(false)
      setTheme("")
      setDescription("")
      navigate(`/workspaces/${result.workspaceId}`)
    } finally {
      setCreatingWorkspace(false)
    }
  }

  const handleDelete = (id: string, theme: string) => {
    if (!confirm(`${theme} を削除しますか？`)) return
    deleteWorkspace(id)
    showToast("info", "削除しました")
  }

  const getProgress = (workspaceId: string) => {
    const workspace = workspacesById[workspaceId]
    if (!workspace) return { answered: 0, total: 0 }

    const questionNodes = Object.values(nodesById)
      .filter((n): n is TQuestionNode => n.workspaceId === workspaceId && isQuestionNode(n))

    const total = questionNodes.length
    const answered = questionNodes.filter((n) => n.answer?.trim()).length

    return { answered, total }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <Toast />

      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ぎろんもーる</h1>
            <button
              onClick={() => navigate("/settings")}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              アプリ設定
            </button>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!appSettings.openRouterApiKey.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              新規作成
            </button>
            {!appSettings.openRouterApiKey.trim() && (
              <button
                onClick={() => navigate("/settings")}
                className="text-xs text-blue-600 hover:underline"
              >
                APIキーを設定する
              </button>
            )}
          </div>
        </header>

        {workspaceIds.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">ワークスペースがありません</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-blue-600 hover:underline"
            >
              最初のワークスペースを作成する
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {workspaceIds.map((id) => {
              const ws = workspacesById[id]
              if (!ws) return null
              const { answered, total } = getProgress(id)
              const progress = total > 0 ? `${answered}/${total} 回答済み` : "質問なし"

              return (
                <div key={id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-lg font-semibold line-clamp-2">{ws.theme}</h2>
                  </div>
                  {ws.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{ws.description}</p>
                  )}
                  <div className="text-sm text-gray-500 mb-4">
                    <div className="mb-1">{progress}</div>
                    <div>更新: {new Date(ws.updatedAt).toLocaleString("ja-JP")}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/workspaces/${id}`)}
                      className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm"
                    >
                      開く
                    </button>
                    <button
                      onClick={() => navigate(`/workspaces/${id}/settings`)}
                      className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"
                    >
                      設定
                    </button>
                    <button
                      onClick={() => handleDelete(id, ws.theme)}
                      className="px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 text-sm"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="新規ワークスペース"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">テーマ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="例: 新しいプロジェクトの計画"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">追加説明（任意）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-24"
              placeholder="例: 厳しめの視点で検討します"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleCreate}
              disabled={!theme.trim() || creatingWorkspace || !appSettings.openRouterApiKey.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingWorkspace ? "生成中..." : "作成"}
            </button>
            {!appSettings.openRouterApiKey.trim() && (
              <button
                onClick={() => navigate("/settings")}
                className="text-xs text-blue-600 hover:underline"
              >
                APIキーを設定する
              </button>
            )}
          </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
