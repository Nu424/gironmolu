import { z } from "zod/v3"

type TreeNodeOutput = {
  type: "heading" | "question" | "note"
  title?: string
  question?: string
  text?: string
  children: TreeNodeOutput[]
}

export const TreeNodeOutputSchema: z.ZodType<TreeNodeOutput> = z.discriminatedUnion(
  "type",
  [
  z.object({
    type: z.literal("heading"),
    title: z.string(),
    children: z.lazy(() => z.array(TreeNodeOutputSchema)),
  }),
  z.object({
    type: z.literal("question"),
    question: z.string(),
    children: z.lazy(() => z.array(TreeNodeOutputSchema)),
  }),
  z.object({
    type: z.literal("note"),
    text: z.string(),
    children: z.lazy(() => z.array(TreeNodeOutputSchema)),
  }),
  ]
)

export const InitialGenerateOutputSchema = z.object({
  guidelines: z.array(z.string()).min(5).max(10),
  tree: z.array(TreeNodeOutputSchema),
})

export type InitialGenerateOutput = z.infer<typeof InitialGenerateOutputSchema>

export const ReconstructOutputSchema = z.object({
  reconstructedText: z.string(),
})

export type ReconstructOutput = z.infer<typeof ReconstructOutputSchema>

export const FollowupGenerateOutputSchema = z.object({
  newQuestions: z.array(
    z.object({
      question: z.string(),
      parentId: z.string().nullable(),
    })
  ),
})

export type FollowupGenerateOutput = z.infer<typeof FollowupGenerateOutputSchema>

export const AssistAnswerOutputSchema = z.object({
  answer: z.string(),
})

export type AssistAnswerOutput = z.infer<typeof AssistAnswerOutputSchema>
