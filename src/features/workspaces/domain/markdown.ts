import type { Workspace, TextNode, TreeNode } from "@/types/domain"
import { buildTree } from "./tree"

const MAX_ANSWER_CHARS = 200

export function workspaceToMarkdown(
  workspace: Workspace,
  nodes: TextNode[]
): string {
  const lines: string[] = []
  const tree = buildTree(nodes)

  lines.push(`# ${workspace.theme}`)
  if (workspace.description) {
    lines.push(`> 追加説明: ${workspace.description}`)
  }
  lines.push("")

  function renderTreeNode(node: TreeNode, depth: number = 0) {
    const indent = "  ".repeat(depth)

    if (node.type === "heading") {
      lines.push(`${indent}- ${node.title}`)
    } else if (node.type === "note") {
      lines.push(`${indent}- ${node.text}`)
    } else if (node.type === "question") {
      if (node.reconstructedText) {
        lines.push(`${indent}- ${node.reconstructedText}`)
      } else if (node.answer) {
        lines.push(`${indent}- ${node.question}: ${node.answer}`)
      } else {
        lines.push(`${indent}- ${node.question}`)
      }
    }

    node.children.forEach((child) => renderTreeNode(child, depth + 1))
  }

  tree.forEach((node) => renderTreeNode(node))

  return lines.join("\n")
}

export function workspaceToMarkdownForLLM(
  workspace: Workspace,
  nodes: TextNode[]
): string {
  const lines: string[] = []
  const tree = buildTree(nodes)

  lines.push(`# ${workspace.theme}`)
  if (workspace.description) {
    lines.push(`> 追加説明: ${workspace.description}`)
  }
  lines.push("")

  function renderTreeNode(node: TreeNode, depth: number = 0) {
    const indent = "  ".repeat(depth)

    if (node.type === "heading") {
      lines.push(`${indent}- [${node.id}] ${node.title}`)
    } else if (node.type === "note") {
      lines.push(`${indent}- [${node.id}] ${node.text}`)
    } else if (node.type === "question") {
      let answer = node.answer
      if (answer.length > MAX_ANSWER_CHARS) {
        answer = answer.substring(0, MAX_ANSWER_CHARS) + "..."
      }

      if (node.reconstructedText) {
        lines.push(`${indent}- [${node.id}] ${node.reconstructedText}`)
      } else if (answer) {
        lines.push(`${indent}- [${node.id}] ${node.question}: ${answer}`)
      } else {
        lines.push(`${indent}- [${node.id}] ${node.question}`)
      }
    }

    node.children.forEach((child) => renderTreeNode(child, depth + 1))
  }

  tree.forEach((node) => renderTreeNode(node))

  return lines.join("\n")
}

export function formatGuidelines(guidelines: string[]): string {
  return guidelines.map((g) => `- ${g}`).join("\n")
}

export function formatGuidelinesToText(guidelines: string[]): string {
  return guidelines.map((g) => `${g}`).join("\n")
}
