import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { usePersistStore } from "@/stores/persistStore"
import { workspaceToMarkdown } from "@/features/workspaces/domain/markdown"
import { Toast } from "@/components/Toast"
import type { WorkspaceId } from "@/types/domain"

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const { workspacesById, nodesById, updateWorkspace } = usePersistStore()

  const workspace = workspaceId ? workspacesById[workspaceId as WorkspaceId] : undefined

  const [theme, setTheme] = useState(workspace?.theme ?? "")
  const [description, setDescription] = useState(workspace?.description ?? "")
  const [guidelineText, setGuidelineText] = useState(workspace?.guidelineText ?? "")
  const [followupCount, setFollowupCount] = useState(workspace?.config.followupCount ?? 3)

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
  const markdown = workspaceToMarkdown(workspace, nodes)

  const handleSave = () => {
    updateWorkspace({
      id: workspaceId as WorkspaceId,
      theme: theme.trim(),
      description: description.trim() || undefined,
      guidelineText: guidelineText,
      config: { followupCount },
    })
    navigate(`/workspaces/${workspaceId}`)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      alert("コピーしました")
    } catch {
      alert("コピーに失敗しました")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <Toast />

      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">ワークスペース設定</h1>
        </header>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">テーマ</label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">追加説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">質問生成指針</label>
            <textarea
              value={guidelineText}
              onChange={(e) => setGuidelineText(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-32 resize-none"
              placeholder="例: 厳しめの視点で検討します"
            />
            <p className="text-xs text-gray-500 mt-1">
              追加質問生成時に使用されます（Phase 9で実装）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">追加質問の生成個数</label>
            <input
              type="number"
              min="1"
              max="10"
              value={Number.isNaN(followupCount) ? "" : followupCount}
              onChange={(e) => {
                const value = Number(e.target.value)
                setFollowupCount(Number.isNaN(value) ? 3 : value)
              }}
              className="w-full border rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              一度に生成する追加質問の数（Phase 9で実装）
            </p>
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              保存して戻る
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">エクスポート</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <textarea
              readOnly
              value={markdown}
              className="w-full border rounded-lg px-3 py-2 h-48 resize-none font-mono text-sm"
            />
            <div className="mt-2">
              <button
                onClick={handleCopy}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
              >
                コピー
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => navigate(`/workspaces/${workspaceId}`)}
            className="text-gray-600 hover:text-gray-800"
          >
            ← ワークスペースに戻る
          </button>
        </div>
      </div>
    </div>
  )
}
