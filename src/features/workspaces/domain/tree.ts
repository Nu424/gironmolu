import type { TextNode, TreeNode, NodeId } from "@/types/domain"

export function buildTree(nodes: TextNode[]): TreeNode[] {
  const byParent = new Map<string, TreeNode[]>()
  const byId = new Map<string, TreeNode>()

  nodes.forEach((n) => {
    byId.set(n.id, { ...n, children: [] })
  })

  byId.forEach((n) => {
    const key = n.parentId ?? "__root__"
    const list = byParent.get(key) ?? []
    list.push(n)
    byParent.set(key, list)
  })

  byParent.forEach((list) => {
    list.sort((a, b) => a.order - b.order)
  })

  byId.forEach((n) => {
    const key = n.id
    n.children = byParent.get(key) ?? []
  })

  return byParent.get("__root__") ?? []
}

export function deleteNodeCascade(
  nodesById: Record<NodeId, TextNode>,
  nodeId: NodeId
): NodeId[] {
  const toDelete: NodeId[] = []
  const queue: NodeId[] = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    toDelete.push(currentId)

    const currentNode = nodesById[currentId]
    if (!currentNode) continue

    Object.entries(nodesById).forEach(([id, node]) => {
      if (node.parentId === currentId) {
        queue.push(id as NodeId)
      }
    })
  }

  return toDelete
}

export function getDescendantIds(
  nodesById: Record<NodeId, TextNode>,
  nodeId: NodeId
): NodeId[] {
  const descendants: NodeId[] = []
  const queue: NodeId[] = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    Object.entries(nodesById).forEach(([id, node]) => {
      if (node.parentId === currentId && id !== nodeId) {
        descendants.push(id as NodeId)
        queue.push(id as NodeId)
      }
    })
  }

  return descendants
}

export function findNodeIdsByParentId(
  nodesById: Record<NodeId, TextNode>,
  parentId: NodeId | null
): NodeId[] {
  return Object.entries(nodesById)
    .filter(([, node]) => node.parentId === parentId)
    .map(([id]) => id)
}

export type InitialTreeNode = {
  type: "heading" | "question" | "note"
  title?: string
  question?: string
  text?: string
  children?: InitialTreeNode[]
}
