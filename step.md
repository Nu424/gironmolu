# ぎろんもーる v1 開発ステップ

## Phase 1: プロジェクトセットアップ

### Step 1.1: プロジェクト初期化
- React + TypeScript プロジェクトを作成（Vite推奨）
- 必要なパッケージのインストール
  - `zustand`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
  - `react-router-dom` (HashRouter使用)
  - `nanoid` (ID生成)
  - `zod` (バリデーション)

### Step 1.2: ディレクトリ構造作成
```
src/
  app/
  stores/
  features/
  lib/
  styles/
```

### Step 1.3: 基本設定
- tsconfig.json の設定
- ESLint / Prettier の設定
- ルーティングの基本構成（HashRouter）

---

## Phase 2: 型定義とドメインモデル

### Step 2.1: 型定義ファイル作成
- `src/types/domain.ts` に以下を定義
  - `Workspace`, `QuestionNode`, `NoteNode`, `HeadingNode`, `TextNode`
  - `AppSettings`
  - `NodeType` など

### Step 2.2: ドメインロジック関数
- `src/features/workspaces/domain/tree.ts`
  - `buildTree()`: フラットからツリー構造へ
  - `flattenTree()`: ツリーからフラットへ
  - `deleteNodeCascade()`: カスケード削除

### Step 2.3: Markdown変換関数
- `src/features/workspaces/domain/markdown.ts`
  - `workspaceToMarkdown()`: エクスポート用（IDなし）
  - `workspaceToMarkdownForLLM()`: LLM用（IDあり、文字数制限）

### Step 2.4: 並び替えユーティリティ
- `src/features/workspaces/domain/ordering.ts`
  - `reorderSiblings()` のロジック

---

## Phase 3: Zustand Store 設計

### Step 3.1: Persist Store
- `src/stores/persistStore.ts`
  - 状態: `appSettings`, `workspaceIds`, `workspacesById`, `nodesById`
  - アクション:
    - `createWorkspaceWithLLM()`
    - `updateWorkspace()`, `deleteWorkspace()`
    - `addNode()`, `updateNode()`, `deleteNode()`
    - `reorderSiblings()`
  - Zustand persist で localStorage に永続化

### Step 3.2: UI Store
- `src/stores/uiStore.ts`
  - 状態: `creatingWorkspace`, `nodeBusy`, `rootBusyByWorkspace`, `toast`, `expanded`
  - アクション: 各種状態更新関数

---

## Phase 4: LLM 連携基盤

### Step 4.1: OpenRouter クライアント
- `src/lib/llm/client.ts`
  - API 呼び出し関数（fetchベース）
  - 認証ヘッダー設定: `Authorization: Bearer ${OPENROUTER_API_KEY}`
  - エラーハンドリング（401/429/5xx）

### Step 4.2: スキーマ定義
- `src/lib/llm/schemas.ts`
  - `InitialGenerateOutput`
  - `ReconstructOutput`
  - `FollowupGenerateOutput`
  - Zod スキーマでバリデーション

### Step 4.3: プロンプトテンプレート
- `src/lib/llm/prompts.ts`
  - `buildInitialGeneratePrompt()`
  - `buildReconstructPrompt()`
  - `buildFollowupGeneratePrompt()`

### Step 4.4: LLM 呼び出しラッパー
- `src/lib/llm/api.ts`
  - `generateInitialTree()`
  - `generateReconstructedText()`
  - `generateFollowupQuestions()`
  - JSON パース + エラー処理
  - **構造化出力**: `response_format: { type: "json_schema", ... }` を使用

---

## Phase 5: アプリ設定画面

### Step 5.1: AppSettingsPage コンポーネント
- OpenRouter API Key 入力（password input）
- モデル選択（プリセット + 自由入力）
  - 推奨: `openai/gpt-4o-mini`, `google/gemini-2.5-flash`, `anthropic/claude-sonnet-4`
- 簡易接続テスト機能（短いプロンプトで1回呼ぶ）

### Step 5.2: API キー未設定時のガード
- Store で API キー有無をチェック
- 未設定時のエラーハンドリング

---

## Phase 6: ワークスペース一覧画面

### Step 6.1: WorkspaceListPage コンポーネント
- ワークスペースカード一覧表示
- テーマ、更新日時、進捗表示（回答済み/質問数）
- 新規作成ボタン

### Step 6.2: モーダル: 新規ワークスペース作成
- テーマ入力（必須）
- 追加説明入力（任意）
- 作成ボタン（API キー未設定時は無効化）
- 作成中のローディング表示
- 成功でメイン画面遷移、失敗でエラートースト

---

## Phase 7: ワークスペースメイン画面

### Step 7.1: WorkspacePage 基本構成
- ヘッダー（テーマ、追加説明）
- 右上アクション:
  - ルートに追加質問生成（LLM）
  - ルートに手動追加（+）
  - 設定へ
- ツリービュー描画エリア

### Step 7.2: NodeRow コンポーネント共通
- 各ノードタイプの行コンポーネント
- `QuestionRow`, `HeadingRow`, `NoteRow`
- 編集可能なテキストエリア

### Step 7.3: TreeView コンポーネント
- ツリー構造の描画
- インデント表示（2スペース）
- 折りたたみ機能（expanded 状態管理）

---

## Phase 8: D&D 並び替え

### Step 8.1: dnd-kit の基本設定
- `DndContext` の配置
- `SortableContext` の実装

### Step 8.2: 並び替えの実装
- 同一親（siblings）内の並び替え
- `onDragEnd` で `reorderSiblings()` を呼ぶ
- ドラッグ可能な UI 要素

---

## Phase 9: LLM 機能の統合

### Step 9.1: 初期ツリー生成
- ワークスペース作成時の LLM 呼び出し
- `guidelines` + `tree` のパース
- ノードのフラット化と保存

### Step 9.2: 再構成機能
- question ノードの「再構成」ボタン
- Q+A → reconstructedText 生成
- 成功後に追加質問生成を実行

### Step 9.3: 追加質問生成
- 自動挿入ロジック
- `parentId` のバリデーション（存在しないIDはnullへフォールバック）
- 兄弟ノードの末尾に追加

---

## Phase 10: ワークスペース設定画面

### Step 10.1: WorkspaceSettingsPage コンポーネント
- テーマ編集
- 追加説明編集
- 質問生成指針編集（複数行テキスト）
- 追加質問数設定（number input, デフォルト3）

### Step 10.2: エクスポート機能
- Markdown 表示用 textarea
- コピーボタン
- ID を含めない形式で出力

---

## Phase 11: UI/UX の改善

### Step 11.1: ローディング状態
- ノードごとのローディング表示（`nodeBusy`）
- ルート全体のローディング表示（`rootBusyByWorkspace`）
- ボタンの disabled 状態管理

### Step 11.2: エラーハンドリング
- トースト通知システム
- 401/429/5xx エラーの表示
- JSON パースエラーのハンドリング

### Step 11.3: 追加質問のハイライト
- 直近追加された質問の視覚的強調
- 折りたたみ状態のデフォルト設定

---

## Phase 12: テストとリファクタリング

### Step 12.1: 単体テスト
- ドメインロジック関数のテスト
- Markdown 変換のテスト
- Store アクションのテスト

### Step 12.2: E2E テスト（オプション）
- 主要なユースケースのテスト
  - ワークスペース作成
  - 質問回答→再構成
  - 追加質問生成

### Step 12.3: パフォーマンス最適化
- LLM コンテキストの文字数制限（回答最大200字等）
- 大量ノード時のレンダリング最適化
- localStorage 容量対策（長文はエクスポート推奨）

---

## Phase 13: デプロイ準備

### Step 13.1: ビルド設定
- 静的ホスティング向けの設定
- GitHub Pages / Netlify / Vercel 対応

### Step 13.2: 本番環境設定
- 環境変数の管理
- エラーログの設定

---

## 優先度マーク

- **高優先度**: MVP に必須（Phase 1-9）
- **中優先度**: UX 向上（Phase 10-11）
- **低優先度**: テスト・最適化（Phase 12-13）

---

## 開発の進め方の推奨

1. **Phase 1-2** まで完了してから UI 開開始
2. **Phase 3-4** の Store + LLM 基盤を固める
3. **Phase 5-7** で画面を順番に実装
4. **Phase 8** で D&D を追加
5. **Phase 9** で LLM 機能を統合
6. 残りの機能は必要に応じて実装

---

## LLM API 呼び出しの要点

**OpenRouter API 呼び出しの基本構造:**
- エンドポイント: `https://openrouter.ai/api/v1/chat/completions`
- ヘッダー: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `Content-Type: application/json`
- ボディ:
  - `model`: モデル名（例: `openai/gpt-4o-mini`）
  - `messages`: メッセージ配列（system, user, assistant）
  - `response_format`: 構造化出力（JSON Schema）
  - `stream`: false（v1はストリーミングなし）

**構造化出力の実装:**
```typescript
response_format: {
  type: "json_schema",
  json_schema: {
    name: "schemaName",
    strict: true,
    schema: { /* Zodから生成したスキーマ */ }
  }
}
```

**推奨モデル:**
- `openai/gpt-4o-mini` - 低コスト、高品質
- `google/gemini-2.5-flash` - 高速
- `anthropic/claude-sonnet-4` - 高精度

**エラーハンドリング:**
- 401: APIキー未設定または無効
- 429: レート制限超過
- 5xx: サーバーエラー
- JSON parseエラー: 構造化出力の失敗
