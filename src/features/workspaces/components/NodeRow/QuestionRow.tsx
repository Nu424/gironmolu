import { useState, useEffect } from "react"
import type { TreeNode, WorkspaceId, QuestionNode as TQuestionNode } from "@/types/domain"
import { usePersistStore } from "@/stores/persistStore"
import { useUIStore } from "@/stores/uiStore"
import { Trash2, ChevronRight, ChevronDown, Plus } from "lucide-react"
import { generateReconstructedText, toUserFriendlyError } from "@/lib/llm/api"

const childOptions = [
  { label: "質問", value: "question" },
  { label: "メモ", value: "note" },
  { label: "見出し", value: "heading" },
] as const

type QuestionRowProps = {
  node: TQuestionNode & { children: TreeNode[] }
  workspaceId: WorkspaceId
  expanded: boolean
  onToggleExpanded: () => void
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
}

export default function QuestionRow({
  node,
  workspaceId,
  expanded,
  onToggleExpanded,
  dragHandleProps,
}: QuestionRowProps) {
  const { updateNode, addNode, deleteNode, appSettings, generateFollowupQuestionsForWorkspace } = usePersistStore()
  const { nodeBusy, setNodeBusy, setExpanded, showToast, flashHighlight } = useUIStore()

  const [question, setQuestion] = useState(node.question)
  const [answer, setAnswer] = useState(node.answer)
  const [reconstructedText, setReconstructedText] = useState(node.reconstructedText)

  useEffect(() => {
    setQuestion(node.question)
    setAnswer(node.answer)
    setReconstructedText(node.reconstructedText)
  }, [node])

  const handleBlur = (field: "question" | "answer" | "reconstructedText", value: string) => {
    const current = field === "question" ? node.question : field === "answer" ? node.answer : node.reconstructedText
    if (value === current) return

    updateNode({
      id: node.id,
      [field]: value,
    })
  }

  const handleAddChild = (type: "question" | "note" | "heading") => {
    if (type === "question") {
      addNode({
        workspaceId,
        parentId: node.id,
        type: "question",
        question: "",
        answer: "",
        reconstructedText: "",
      })
    } else if (type === "note") {
      addNode({
        workspaceId,
        parentId: node.id,
        type: "note",
        text: "",
      })
    } else {
      addNode({
        workspaceId,
        parentId: node.id,
        type: "heading",
        title: "",
      })
    }

    if (!expanded) {
      onToggleExpanded()
    }
  }

  const handleDelete = () => {
    if (!confirm("この質問とその配下のすべてのノードを削除しますか？")) return
    deleteNode(node.id)
    showToast("info", "削除しました")
  }

  const handleReconstruct = async () => {
    if (!appSettings.openRouterApiKey.trim()) {
      showToast("error", "APIキーが設定されていません。アプリ設定で設定してください")
      return
    }

    setNodeBusy(node.id, "reconstructing")

    try {
      const reconstructResult = await generateReconstructedText(
        question,
        answer,
        appSettings.openRouterApiKey,
        appSettings.model
      )

      updateNode({
        id: node.id,
        reconstructedText: reconstructResult.reconstructedText,
      })

      setNodeBusy(node.id, "generatingFollowups")

      const followupResult = await generateFollowupQuestionsForWorkspace(workspaceId, node.id)
      followupResult.expandIds.forEach((expandId) => {
        setExpanded(expandId, true)
      })
      flashHighlight(followupResult.nodeIds, 3000)

      showToast("info", `${followupResult.nodeIds.length}個の質問を追加しました`)
    } catch (err) {
      const message = toUserFriendlyError(err)
      showToast("error", message)
    } finally {
      setNodeBusy(node.id, undefined)
    }
  }

  const handleGenerateFollowupQuestions = async () => {
    if (!appSettings.openRouterApiKey.trim()) {
      showToast("error", "APIキーが設定されていません。アプリ設定で設定してください")
      return
    }

    setNodeBusy(node.id, "generatingFollowups")

    try {
      const followupResult = await generateFollowupQuestionsForWorkspace(workspaceId, node.id)
      followupResult.expandIds.forEach((expandId) => {
        setExpanded(expandId, true)
      })
      flashHighlight(followupResult.nodeIds, 3000)

      showToast("info", `${followupResult.nodeIds.length}個の質問を追加しました`)
    } catch (err) {
      const message = toUserFriendlyError(err)
      showToast("error", message)
    } finally {
      setNodeBusy(node.id, undefined)
    }
  }

  const isBusy = nodeBusy[node.id]
  const hasApiKey = appSettings.openRouterApiKey.trim().length > 0

  const hasChildren = node.children.length > 0

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-start gap-2 p-2 hover:bg-gray-50">
        <button
          onClick={onToggleExpanded}
          className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <span className="w-4" />
          )}
        </button>

        <button
          type="button"
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          title="ドラッグして並び替え"
          {...dragHandleProps}
        >
          ⋮⋮
        </button>

        <div className="flex-1 space-y-2">
          <div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onBlur={(e) => handleBlur("question", e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm resize-none min-h-[2.5em]"
              placeholder="質問を入力..."
            />
          </div>

          <div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onBlur={(e) => handleBlur("answer", e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm resize-none min-h-[4em]"
              placeholder="回答を入力..."
            />
          </div>

          <div>
            <textarea
              value={reconstructedText}
              onChange={(e) => setReconstructedText(e.target.value)}
              onBlur={(e) => handleBlur("reconstructedText", e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm resize-none min-h-[2.5em]"
              placeholder="再構成テキスト..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReconstruct}
              disabled={!answer.trim() || !!isBusy}
              title={answer.trim() ? "" : "回答を入力してください"}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy === "reconstructing" ? "再構成中..." : "再構成"}
            </button>
            <button
              onClick={handleGenerateFollowupQuestions}
              disabled={!!isBusy || !hasApiKey}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy === "generatingFollowups" ? "生成中..." : "質問を追加（LLM）"}
            </button>
            {!hasApiKey && (
              <button
                onClick={() => window.location.assign("#/settings")}
                className="text-xs text-blue-600 hover:underline"
              >
                APIキーを設定する
              </button>
            )}
            <label className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-gray-100">
              <Plus size={12} />
              <span>子を追加</span>
              <select
                className="text-xs border-l pl-1 bg-transparent"
                onChange={(e) => {
                  const value = e.target.value as "question" | "note" | "heading" | ""
                  if (!value) return
                  handleAddChild(value)
                  e.currentTarget.selectedIndex = 0
                }}
              >
                <option value="">種類</option>
                {childOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={handleDelete}
              className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 flex items-center gap-1"
            >
              <Trash2 size={12} /> 削除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
