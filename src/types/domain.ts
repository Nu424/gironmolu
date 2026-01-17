export type WorkspaceId = string
export type NodeId = string

export type NodeType = "question" | "note" | "heading"

export type Workspace = {
  id: WorkspaceId
  theme: string
  description?: string
  guidelineText: string
  config: {
    followupCount: number
  }
  createdAt: number
  updatedAt: number
}

type NodeBase = {
  id: NodeId
  workspaceId: WorkspaceId
  type: NodeType
  parentId: NodeId | null
  order: number
  createdAt: number
  updatedAt: number
  origin: "user" | "llm"
}

export type QuestionNode = NodeBase & {
  type: "question"
  question: string
  answer: string
  reconstructedText: string
}

export type NoteNode = NodeBase & {
  type: "note"
  text: string
}

export type HeadingNode = NodeBase & {
  type: "heading"
  title: string
}

export type TextNode = QuestionNode | NoteNode | HeadingNode

export type AppSettings = {
  openRouterApiKey: string
  model: string
}

export type TreeNode = TextNode & {
  children: TreeNode[]
}

export type NodeBusy = "reconstructing" | "generatingFollowups"
