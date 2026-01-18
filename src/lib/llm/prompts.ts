export function buildInitialGeneratePrompt(
  theme: string,
  description: string | undefined
): {
  system: string
  user: string
} {
  const systemPrompt = `あなたは議論を網羅的に言語化するための設計者です。ユーザーが答えやすい具体的な問いを作成してください。`

  const userPrompt = `テーマ: """${theme}"""
${description ? `追加説明: """${description}"""` : ""}

要件:
- このテーマを検討/言語化するための「議論の大枠（観点）」を必要な個数、短い日本語の箇条書きで作る
- その観点に基づき、初期ツリーを作る（headingを基本にし、各headingに1〜3個のquestionをぶら下げる）
- 質問は具体的で答えやすく、Yes/Noで終わらない
- 1質問1論点
- 前提/制約/具体例/評価軸/代替案/リスク/次アクションを意識する
- 出力は必ずJSONのみ（コードフェンスや説明文は禁止）

出力形式:
{
  "guidelines": ["観点1", "観点2", ...],
  "tree": [
    { "type":"heading", "title":"見出し", "children":[
      { "type":"question", "question":"質問" }
    ]}
  ]
}`

  return { system: systemPrompt, user: userPrompt }
}

export function buildReconstructPrompt(
  question: string,
  answer: string
): {
  system: string
  user: string
} {
  const systemPrompt = `あなたは文章を簡潔に要約する専門家です。`

  const userPrompt = `質問: """${question}"""
回答: """${answer}"""

指示:
- 回答内容を簡潔に表現する1文を作る
- 形式は「{要点名}: {内容}」のように自然な日本語で
- 出力はJSONのみ

出力形式:
{ "reconstructedText": "要点: 内容" }`

  return { system: systemPrompt, user: userPrompt }
}

export function buildFollowupGeneratePrompt(
  theme: string,
  description: string | undefined,
  guidelineText: string,
  workspaceMarkdownWithIds: string,
  count: number,
  originNodeId?: string
): {
  system: string
  user: string
} {
  const systemPrompt = `あなたは議論を深めるための質問を生成する専門家です。`

  let originPrompt = ""
  if (originNodeId) {
    originPrompt = `\n\n【起点ノード】\n質問生成の起点となるノードID: ${originNodeId}\nこのノード配下の質問を優先的に生成してください。`
  }

  const userPrompt = `テーマ: """${theme}"""
${description ? `追加説明: """${description}"""` : ""}
質問生成指針: """${guidelineText}"""${originPrompt}

現在のワークスペース（ID付き）:
${workspaceMarkdownWithIds}

要件:
- 新しい質問を${count}個生成
- 既存の質問/内容の言い換えを避ける
- 1質問1論点、Yes/Noで終わらない
- parentIdは上記の [xxxx] に出てくるIDを **括弧なし** で指定（見つからなければ null）
- 出力例: { "question": "質問", "parentId": "abc123" } または { "question": "質問", "parentId": null }
- 前提/制約/具体例/評価軸/代替案/リスク/次アクションを意識する
- 出力はJSONのみ

出力形式:
{
  "newQuestions": [
    { "question": "追加質問1", "parentId": "ノードID or null" }
  ]
}`

  return { system: systemPrompt, user: userPrompt }
}

export function buildAssistAnswerPrompt(
  theme: string,
  description: string | undefined,
  guidelineText: string,
  workspaceMarkdown: string,
  question: string
): {
  system: string
  user: string
} {
  const systemPrompt = `あなたは既存の回答内容から補助的に答えを埋めるアシスタントです。`

  const userPrompt = `テーマ: """${theme}"""
${description ? `追加説明: """${description}"""` : ""}
質問生成指針: """${guidelineText}"""

現在のワークスペース:
${workspaceMarkdown}

対象の質問:
"""${question}"""

指示:
- 既存の回答・メモから読み取れる・推測される内容のみを使う
- 回答は短く1-2文で簡潔に表現する(敬体・敬称は不要)
- 出力はJSONのみ

出力形式:
{ "answer": "..." }`

  return { system: systemPrompt, user: userPrompt }
}
