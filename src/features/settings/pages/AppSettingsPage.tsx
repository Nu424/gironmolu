import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { usePersistStore } from "@/stores/persistStore"
import { Toast } from "@/components/Toast"
import { useUIStore } from "@/stores/uiStore"

export default function AppSettingsPage() {
  const navigate = useNavigate()
  const { appSettings, updateAppSettings, testConnection } = usePersistStore()
  const { showToast } = useUIStore()
  const [apiKey, setApiKey] = useState(appSettings.openRouterApiKey)
  const [model, setModel] = useState(appSettings.model)
  const [modelChoice, setModelChoice] = useState(
    [
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
      "anthropic/claude-sonnet-4",
    ].includes(appSettings.model)
      ? appSettings.model
      : "custom"
  )

  const modelPresets = [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "anthropic/claude-sonnet-4",
  ]

  const handleSave = () => {
    updateAppSettings({ openRouterApiKey: apiKey, model })
    navigate("/")
  }

  const [testingConnection, setTestingConnection] = useState(false)

  const handleTestConnection = async () => {
    setTestingConnection(true)

    const result = await testConnection({ apiKey, model })

    setTestingConnection(false)

    if (result.success) {
      showToast("info", "接続に成功しました")
    } else {
      showToast("error", `接続に失敗しました: ${result.error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <Toast />

      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold mb-2">アプリ設定</h1>
          <p className="text-gray-600">
            LLM（OpenRouter API）の設定を行います。API キーはブラウザの localStorage に保存されます。
          </p>
        </header>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="sk-or-..."
            />
            <p className="text-xs text-gray-500 mt-1">
              OpenRouter で取得した API キーを入力してください。
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline ml-2"
              >
                キーの発行（外部サイト）
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              使用モデル
            </label>
            <select
              value={modelChoice}
              onChange={(e) => {
                const value = e.target.value
                setModelChoice(value)
                if (value !== "custom") {
                  setModel(value)
                }
              }}
              className="w-full border rounded-lg px-3 py-2"
            >
              {modelPresets.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
              <option value="custom">カスタム</option>
            </select>
            {modelChoice === "custom" && (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-2"
                placeholder="モデル名を入力（例: openai/gpt-4o）"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              推奨モデル: openai/gpt-4o-mini（安価・高速）
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testingConnection ? "テスト中..." : "接続テスト（LLM）"}
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              保存して戻る
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-gray-600 hover:text-gray-800"
          >
            ← トップに戻る
          </button>
        </div>
      </div>
    </div>
  )
}
