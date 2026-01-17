import type { TextNode, NodeId } from "@/types/domain"

export function reorderSiblings(
  siblings: TextNode[],
  orderedIds: NodeId[]
): TextNode[] {
  const idToNode = new Map(siblings.map((n) => [n.id, n]))

  return orderedIds
    .map((id) => idToNode.get(id))
    .filter((n): n is TextNode => n !== undefined)
    .map((n, index) => ({ ...n, order: index }))
}

export function validateReorder(
  siblings: TextNode[],
  orderedIds: NodeId[]
): { valid: boolean; error?: string } {
  const siblingIds = new Set(siblings.map((n) => n.id))

  for (const id of orderedIds) {
    if (!siblingIds.has(id)) {
      return { valid: false, error: `Node ${id} is not a sibling` }
    }
  }

  if (orderedIds.length !== siblings.length) {
    return {
      valid: false,
      error: "Ordered IDs count does not match siblings count",
    }
  }

  return { valid: true }
}

export function findNextOrder(siblings: TextNode[]): number {
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((n) => n.order)) + 1
}
