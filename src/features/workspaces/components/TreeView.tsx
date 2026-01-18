import { DndContext, closestCenter } from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { ButtonHTMLAttributes } from "react"
import { usePersistStore } from "@/stores/persistStore"
import { useUIStore } from "@/stores/uiStore"
import type { TreeNode, WorkspaceId } from "@/types/domain"
import QuestionRow from "./NodeRow/QuestionRow"
import HeadingRow from "./NodeRow/HeadingRow"
import NoteRow from "./NodeRow/NoteRow"

type TreeViewProps = {
  nodes: TreeNode[]
  workspaceId: WorkspaceId
  parentId: string | null
  depth: number
}

type TreeNodeComponentProps = {
  node: TreeNode
  workspaceId: WorkspaceId
  depth: number
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>
}

function TreeNodeComponent({ node, workspaceId, depth, dragHandleProps }: TreeNodeComponentProps) {
  const expanded = useUIStore((s) => s.expanded[node.id])
  const toggleExpanded = useUIStore((s) => s.toggleExpanded)

  const handleToggleExpanded = () => {
    toggleExpanded(node.id)
  }

  const rowProps = {
    workspaceId,
    expanded: expanded ?? false,
    onToggleExpanded: handleToggleExpanded,
    dragHandleProps,
  }

  if (node.type === "question") {
    return (
      <div style={{ paddingLeft: `${depth * 16}px` }}>
        <QuestionRow node={node} {...rowProps} />
        {expanded && node.children.length > 0 && (
          <TreeView
            nodes={node.children}
            workspaceId={workspaceId}
            parentId={node.id}
            depth={depth + 1}
          />
        )}
      </div>
    )
  }

  if (node.type === "heading") {
    return (
      <div style={{ paddingLeft: `${depth * 16}px` }}>
        <HeadingRow node={node} {...rowProps} />
        {expanded && node.children.length > 0 && (
          <TreeView
            nodes={node.children}
            workspaceId={workspaceId}
            parentId={node.id}
            depth={depth + 1}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <NoteRow node={node} {...rowProps} />
      {expanded && node.children.length > 0 && (
        <TreeView
          nodes={node.children}
          workspaceId={workspaceId}
          parentId={node.id}
          depth={depth + 1}
        />
      )}
    </div>
  )
}

function SortableTreeNode({ node, workspaceId, depth }: { node: TreeNode; workspaceId: WorkspaceId; depth: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  }

  const dragHandleProps = { ...attributes, ...(listeners ?? {}) } as ButtonHTMLAttributes<HTMLButtonElement>

  return (
    <div ref={setNodeRef} style={style}>
      <TreeNodeComponent
        node={node}
        workspaceId={workspaceId}
        depth={depth}
        dragHandleProps={dragHandleProps}
      />
    </div>
  )
}

export default function TreeView({ nodes, workspaceId, parentId, depth }: TreeViewProps) {
  const reorderSiblings = usePersistStore((s) => s.reorderSiblings)

  if (nodes.length === 0) {
    if (depth === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          ノードがありません
        </div>
      )
    }
    return null
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const activeIndex = nodes.findIndex((n) => n.id === active.id)
    const overIndex = nodes.findIndex((n) => n.id === over.id)

    if (activeIndex === -1 || overIndex === -1) return

    const newNodes = arrayMove(nodes, activeIndex, overIndex)
    const orderedChildIds = newNodes.map((n) => n.id)

    reorderSiblings({
      workspaceId,
      parentId,
      orderedChildIds,
    })
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="bg-white rounded-lg shadow">
          {nodes.map((node) => (
            <SortableTreeNode
              key={node.id}
              node={node}
              workspaceId={workspaceId}
              depth={depth}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
