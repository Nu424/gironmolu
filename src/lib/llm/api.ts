import {
  callOpenRouterAPI,
  type ChatMessage,
} from "./client"
import {
  InitialGenerateOutputSchema,
  ReconstructOutputSchema,
  FollowupGenerateOutputSchema,
  type InitialGenerateOutput,
  type ReconstructOutput,
  type FollowupGenerateOutput,
} from "./schemas"
import { buildInitialGeneratePrompt, buildReconstructPrompt, buildFollowupGeneratePrompt } from "./prompts"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

const toJsonSchema = (schema: z.ZodTypeAny) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodToJsonSchema(schema as unknown as any)

async function parseJSON<T>(content: string, schema: z.ZodSchema<T>): Promise<T> {
  try {
    const json = JSON.parse(content)
    return schema.parse(json)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JSON parse failed: ${error.message}`)
    }
    throw new Error("JSON parse failed: unknown error")
  }
}

export async function generateInitialTree(
  theme: string,
  description: string | undefined,
  apiKey: string,
  model: string
): Promise<InitialGenerateOutput> {
  const { system, user } = buildInitialGeneratePrompt(theme, description)

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ]

  const response = await callOpenRouterAPI({
    apiKey,
    model,
    messages,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "initialGenerate",
        strict: true,
        schema: toJsonSchema(InitialGenerateOutputSchema),
      },
    },
  })

  const content = response.choices[0].message.content
  return parseJSON(content, InitialGenerateOutputSchema)
}

export async function generateReconstructedText(
  question: string,
  answer: string,
  apiKey: string,
  model: string
): Promise<ReconstructOutput> {
  const { system, user } = buildReconstructPrompt(question, answer)

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ]

  const response = await callOpenRouterAPI({
    apiKey,
    model,
    messages,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "reconstruct",
        strict: true,
        schema: toJsonSchema(ReconstructOutputSchema),
      },
    },
  })

  const content = response.choices[0].message.content
  return parseJSON(content, ReconstructOutputSchema)
}

export async function generateFollowupQuestions(
  theme: string,
  description: string | undefined,
  guidelineText: string,
  workspaceMarkdownWithIds: string,
  count: number,
  apiKey: string,
  model: string
): Promise<FollowupGenerateOutput> {
  const { system, user } = buildFollowupGeneratePrompt(
    theme,
    description,
    guidelineText,
    workspaceMarkdownWithIds,
    count
  )

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ]

  const response = await callOpenRouterAPI({
    apiKey,
    model,
    messages,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "followupGenerate",
        strict: true,
        schema: toJsonSchema(FollowupGenerateOutputSchema),
      },
    },
  })

  const content = response.choices[0].message.content
  return parseJSON(content, FollowupGenerateOutputSchema)
}
