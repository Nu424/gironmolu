import { useState, useEffect } from "react"
import type { TreeNode, WorkspaceId, NoteNode as TNoteNode } from "@/types/domain"
import { usePersistStore } from "@/stores/persistStore"
import { useUIStore } from "@/stores/uiStore"
import { Trash2, ChevronRight, ChevronDown, Plus } from "lucide-react"

const childOptions = [
  { label: "質問", value: "question" },
  { label: "メモ", value: "note" },
  { label: "見出し", value: "heading" },
] as const

type NoteRowProps = {
  node: TNoteNode & { children: TreeNode[] }
  workspaceId: WorkspaceId
  expanded: boolean
  onToggleExpanded: () => void
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
}

export default function NoteRow({
  node,
  workspaceId,
  expanded,
  onToggleExpanded,
  dragHandleProps,
}: NoteRowProps) {
  const { updateNode, addNode, deleteNode } = usePersistStore()
  const showToast = useUIStore((s) => s.showToast)
  const highlighted = useUIStore((s) => s.highlighted[node.id])

  const [text, setText] = useState(node.text)

  useEffect(() => {
    setText(node.text)
  }, [node])

  const handleBlur = () => {
    if (text === node.text) return
    updateNode({
      id: node.id,
      text,
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
    if (!confirm("このメモとその配下のすべてのノードを削除しますか？")) return
    deleteNode(node.id)
    showToast("info", "削除しました")
  }

  const hasChildren = node.children.length > 0
  const rowTone = highlighted ? "bg-yellow-50" : ""
  const hoverTone = highlighted ? "hover:bg-yellow-100" : "hover:bg-gray-50"

  return (
    <div className="border-b last:border-b-0">
      <div className={`flex items-start gap-2 p-2 transition-colors duration-500 ${rowTone} ${hoverTone}`}>
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleBlur}
              className="w-full border rounded px-2 py-1 text-sm resize-none min-h-[2em]"
              placeholder="メモを入力..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
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
