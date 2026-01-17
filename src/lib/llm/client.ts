const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type OpenRouterResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export type OpenRouterError = {
  error: {
    message: string
    type: string
    code: string | null
  }
}

export async function callOpenRouterAPI(params: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  responseFormat?: {
    type: "json_schema"
    json_schema: {
      name: string
      strict: boolean
      schema: unknown
    }
  }
}): Promise<OpenRouterResponse> {
  const { apiKey, model, messages, responseFormat } = params

  const headers: HeadersInit = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  const body = {
    model,
    messages,
    stream: false,
    ...(responseFormat && { response_format: responseFormat }),
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData: OpenRouterError = await response.json().catch(() => ({
      error: { message: "Unknown error", type: "unknown", code: null },
    }))

    throw createOpenRouterError(
      errorData.error.message || "OpenRouter API request failed",
      response.status,
      errorData.error.type
    )
  }

  const data: OpenRouterResponse = await response.json()
  return data
}

export function createOpenRouterError(
  message: string,
  statusCode: number,
  errorType: string
): Error & { statusCode: number; errorType: string } {
  const error = new Error(message) as Error & { statusCode: number; errorType: string }
  error.statusCode = statusCode
  error.errorType = errorType
  error.name = "OpenRouterAPIError"
  return error
}

export function isOpenRouterError(err: unknown): err is Error & { statusCode: number; errorType: string } {
  return err instanceof Error && "statusCode" in err && "errorType" in err
}
