import { z } from "zod/v3"
import type { Workspace, TextNode, NodeId, WorkspaceId } from "@/types/domain"

const WorkspaceSchema = z.object({
  id: z.string(),
  theme: z.string(),
  description: z.string().optional(),
  guidelineText: z.string(),
  config: z.object({
    followupCount: z.number(),
  }),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const NodeBaseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  type: z.enum(["question", "note", "heading"]),
  parentId: z.string().nullable(),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  origin: z.enum(["user", "llm"]),
})

const QuestionNodeSchema = NodeBaseSchema.extend({
  type: z.literal("question"),
  question: z.string(),
  answer: z.string(),
  reconstructedText: z.string(),
})

const NoteNodeSchema = NodeBaseSchema.extend({
  type: z.literal("note"),
  text: z.string(),
})

const HeadingNodeSchema = NodeBaseSchema.extend({
  type: z.literal("heading"),
  title: z.string(),
})

const TextNodeSchema = z.discriminatedUnion("type", [
  QuestionNodeSchema,
  NoteNodeSchema,
  HeadingNodeSchema,
])

export const WorkspaceExportV1Schema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  workspace: WorkspaceSchema,
  nodes: z.array(TextNodeSchema),
})

export type WorkspaceExportV1 = z.infer<typeof WorkspaceExportV1Schema>

export function serializeWorkspaceExport(workspace: Workspace, nodes: TextNode[]): string {
  const payload: WorkspaceExportV1 = {
    version: 1,
    exportedAt: Date.now(),
    workspace,
    nodes,
  }

  return JSON.stringify(payload, null, 2)
}

export function parseWorkspaceExport(jsonText: string): WorkspaceExportV1 {
  const raw = JSON.parse(jsonText)
  return WorkspaceExportV1Schema.parse(raw)
}

export function importWorkspaceFromExport(
  payload: WorkspaceExportV1,
  newWorkspaceId: WorkspaceId,
  createNodeId: () => NodeId
): { workspace: Workspace; nodes: TextNode[] } {
  const idMap = new Map<NodeId, NodeId>()
  payload.nodes.forEach((node) => {
    idMap.set(node.id as NodeId, createNodeId())
  })

  const workspace: Workspace = {
    ...payload.workspace,
    id: newWorkspaceId,
  }

  const nodes = payload.nodes.map((node) => {
    const newId = idMap.get(node.id as NodeId)
    const mappedParentId = node.parentId ? idMap.get(node.parentId as NodeId) ?? null : null

    return {
      ...node,
      id: newId ?? createNodeId(),
      workspaceId: newWorkspaceId,
      parentId: mappedParentId,
    } as TextNode
  })

  return { workspace, nodes }
}
