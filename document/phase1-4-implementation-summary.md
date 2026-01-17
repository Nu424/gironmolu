# Phase 1-4 実装サマリー

## 背景・目的

「ぎろんもーる v1」は、テーマを入力するとAIが議論の観点（指針＋質問）を提示し、ユーザーが回答→要約（再構成）→追加質問で深掘りしていける、**「網羅的でまんべんない言語化」のためのノートツール**です。

本プロジェクトはフロント完結/BYOK（Bring Your Own Key）構成で、バックエンドを持たず、ユーザーが自身でOpenRouter APIキーを持ち込む形態をとっています。

**Phase 1-4の目的**：
- アプリケーションの技術的基盤（型定義、状態管理、LLM連携）を確立
- Phase 5以降の画面実装のためのドメインロジック・API基盤を提供
- データ永続化と状態管理の仕組みを構築

---

## 全体アーキテクチャ

### 技術スタック
- **フレームワーク**: React 19.2.0 + Vite 7.2.4
- **状態管理**: Zustand 5.0.10（localStorage永続化対応）
- **スタイル**: Tailwind CSS 4.1.18
- **ルーティング**: react-router-dom（HashRouter採用予定）
- **D&D**: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- **ID生成**: nanoid
- **バリデーション**: zod
- **LLM連携**: OpenRouter API（フロントから直接呼び出し）

### ディレクトリ構成

```
src/
  app/
    App.tsx              # メインコンポーネント
  stores/
    persistStore.ts       # localStorage永続化（ワークスペース/ノード/設定）
    uiStore.ts          # UI状態（ローディング/トースト/展開状態）
  features/
    workspaces/
      pages/            # Phase 5+で実装
      components/         # Phase 5+で実装
      domain/
        tree.ts         # ツリー構築・カスケード削除ロジック
        markdown.ts     # Markdown変換（エクスポート/LLMコンテキスト）
        ordering.ts     # 並び替えユーティリティ
  lib/
    llm/
      client.ts        # OpenRouter APIクライアント
      schemas.ts      # Zodスキーマ定義
      prompts.ts      # プロンプトテンプレート
      api.ts          # LLM APIラッパー
  types/
    domain.ts         # TypeScript型定義
  styles/
    index.css        # グローバルスタイル
```

---

## Phase 1: プロジェクトセットアップ

### 実装方針

1. **必要パッケージの一括インストール**
   - ルーティング、D&D、ID生成、バリデーションなど開発に必要なライブラリを導入
   - 依存関係の明確化とバージョン固定

2. **ディレクトリ構造の作成**
   - 機能ごとにディレクトリを分離（features/, lib/, stores/）
   - 再利用可能なドメインロジックは`domain/`ディレクトリに配置
   - 設定ファイルとアプリロジックの分離

3. **TypeScript設定の最適化**
   - パスエイリアス(`@/*`)を設定してインポートを簡潔化
   - `strict: true`を維持し型安全性を確保

### 実装結果

#### 1. パッケージインストール
```json
{
  "dependencies": {
    "react-router-dom": "^7.0.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "nanoid": "^5.0.9",
    "zod": "^3.24.1",
    "zod-to-json-schema": "^1.0.0",
    "zustand": "^5.0.10"
  }
}
```

#### 2. ディレクトリ構造
- `src/app/`: アプリケーションエントリポイント
- `src/stores/`: Zustand Store（永続化・UI）
- `src/features/`: 機能モジュール（workspaces）
- `src/lib/`: 共通ライブラリ（LLM連携）
- `src/types/`: 型定義
- `src/styles/`: スタイルファイル

#### 3. 設定ファイル
- `tsconfig.app.json`: パスエイリアス `@/*` を追加
- `vite.config.ts`: パスエイリアス解決設定を追加
- `src/main.tsx`: インポートパスを`@/styles/index.css`に更新

---

## Phase 2: 型定義とドメインモデル

### 実装方針

1. **厳密な型定義**
   - Union型でノードタイプを区別（QuestionNode | NoteNode | HeadingNode）
   - 共通の基底プロパティ（id, workspaceId, parentId, order等）を`NodeBase`として定義

2. **ドメインロジックの純粋性**
   - React/Zustandへの依存を持たず、純粋な関数として実装
   - 入力・出力を明確にし、再利用性を高める

3. **ツリー構造の動的構築**
   - データはフラットに管理（保存効率化）
   - 表示時にのみツリー構造を構築

### 実装結果

#### 1. 型定義 (`src/types/domain.ts`)

```typescript
export type WorkspaceId = string
export type NodeId = string
export type NodeType = "question" | "note" | "heading"

export type Workspace = {
  id: WorkspaceId
  theme: string
  description?: string
  guidelineText: string
  config: { followupCount: number }
  createdAt: number
  updatedAt: number
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
export type TreeNode = TextNode & { children: TreeNode[] }
```

**ポイント**:
- `origin: "user" | "llm"` で生成元を追跡（運用上の利便性）
- `order`プロパティで兄弟ノード内の順序を管理

#### 2. ツリー操作ロジック (`src/features/workspaces/domain/tree.ts`)

**`buildTree(nodes: TextNode[]): TreeNode[]`**
- フラットなノード配列から階層ツリーを構築
- `parentId`でグルーピングし、`order`でソート
- 時間計算量: O(n)

**`deleteNodeCascade(nodesById, nodeId): NodeId[]`**
- ノードとその子孫を全削除（カスケード削除）
- BFSで探索し、削除対象IDリストを返す
- 呼び出し元でまとめて削除できるため、トランザクション的な処理に対応可能

**`getDescendantIds(nodesById, nodeId): NodeId[]`**
- 指定ノードの子孫IDを取得
- 自身は除外

**`findNodeIdsByParentId(nodesById, parentId): NodeId[]`**
- 指定親の直下の子ノードIDを取得

#### 3. Markdown変換 (`src/features/workspaces/domain/markdown.ts`)

**`workspaceToMarkdown(workspace, nodes): string`**
- エクスポート用のMarkdownを生成（IDなし）
- 形式例:
  ```markdown
  # テーマ

  - 見出し
    - 質問: 回答
  ```

**`workspaceToMarkdownForLLM(workspace, nodes): string`**
- LLMコンテキスト用のMarkdownを生成（ID付き）
- 各行に`[nodeId]`を埋め込み、LLMが親子関係を認識可能に
- 回答は200字に制限（トークン溢れ予防）
- 形式例:
  ```markdown
  # テーマ

  - [n_h1] 見出し
    - [n_q1] 質問: 回答
  ```

**`formatGuidelines(guidelines: string[]): string`**
- 指針リストを箇条書き形式に変換
- `- 観点1\n- 観点2`

#### 4. 並び替えユーティリティ (`src/features/workspaces/domain/ordering.ts`)

**`reorderSiblings(siblings, orderedIds): TextNode[]`**
- 並び替え後のノード配列を生成
- `order`プロパティを0, 1, 2...と振り直す
- バリデーション: 指定されたIDが全て兄弟ノードに含まれているか確認

**`validateReorder(siblings, orderedIds): { valid: boolean, error?: string }`**
- 並び替えリクエストの妥当性チェック
- エラー内容を詳細に返す

**`findNextOrder(siblings): number`**
- 兄弟ノードの末尾に追加するための`order`値を計算
- 空の場合は0、最大+1の場合

---

## Phase 3: Zustand Store 設計

### 実装方針

1. **Storeの分離**
   - **Persist Store**: localStorageに永続化するデータ（ワークスペース、ノード、設定）
   - **UI Store**: メモリ上のみ保持する一時的な状態（ローディング、トースト、展開状態）
   - 目的: localStorage肥大化とバグ回避

2. **永続化の設計**
   - `persist`ミドルウェア使用
   - Storage key: `gironomall:v1`
   - version管理: スキーマ変更時のマイグレーション対応

3. **アクションの明確化**
   - 作成・更新・削除の基本操作を提供
   - LLM呼び出しはPhase 9で実装（アクションのインターフェースのみ定義）

### 実装結果

#### 1. Persist Store (`src/stores/persistStore.ts`)

**状態**:
```typescript
type PersistState = {
  appSettings: AppSettings
  workspaceIds: WorkspaceId[]
  workspacesById: Record<WorkspaceId, Workspace>
  nodesById: Record<NodeId, TextNode>
}
```

**アクション**:
- `createWorkspace()`: ワークスペース作成
  - ID発行（nanoid）、タイムスタンプ設定
  - `workspaceIds`に追加、`workspacesById`に格納

- `updateWorkspace()`: ワークスペース更新
  - 部分更新をサポート
  - `updatedAt`を更新

- `deleteWorkspace()`: ワークスペース削除
  - ワークスペースと紐づくノードを全削除
  - `workspacesById`からも削除（重要: ゴミ防止）

- `addNode()`: ノード追加
  - ID発行、タイムスタンプ設定
  - `order`が未指定の場合、自動計算（兄弟の最大+1）
  - **型安全**: Union型で各ノードタイプの必須プロパティを強制
  - `origin: "user"`で初期値設定

- `updateNode()`: ノード更新
  - 部分更新をサポート
  - `updatedAt`を更新

- `deleteNode()`: ノード削除
  - `deleteNodeCascade()`で子孫を含めて削除
  - まとめて削除対象を処理

- `reorderSiblings()`: 並び替え実行
  - 指定された`orderedChildIds`の順序で`order`を振り直す
  - 同一親の子同士のみ対象

**永続化設定**:
- localStorageへ自動保存
- キー: `gironomall:v1`
- バージョン: 1

#### 2. UI Store (`src/stores/uiStore.ts`)

**状態**:
```typescript
type UIState = {
  creatingWorkspace: boolean
  nodeBusy: Record<NodeId, NodeBusy | undefined>
  rootBusyByWorkspace: Record<WorkspaceId, boolean>
  toast: Toast | null
  expanded: Record<NodeId, boolean>
}
```

**アクション**:
- `setCreatingWorkspace()`: ワークスペース作成中フラグ
- `setNodeBusy()`: ノードごとのローディング状態（再構成中/追加質問生成中）
- `setRootBusy()`: ワークスペース全体のローディング状態
- `showToast()`: トースト通知（error/info）
- `clearToast()`: トーストクリア
- `toggleExpanded()`: ノードの展開/折りたたみ切り替え
- `setExpanded()`: ノードの展開状態を明示設定

---

## Phase 4: LLM連携基盤

### 実装方針

1. **OpenRouter APIの直接呼び出し**
   - バックエンドを介さず、フロントから直接APIを叩く
   - エラーハンドリング（401, 429, 5xx）
   - 認証ヘッダー: `Authorization: Bearer ${apiKey}`

2. **構造化出力の採用**
   - `response_format: { type: "json_schema", ... }`を使用
   - ZodスキーマをJSON Schemaに変換して送信
   - 出力の検証をZodで実施

3. **プロンプトテンプレート化**
   - 変数を埋め込む形でプロンプトを生成
   - 共通のプロンプト方針（1質問1論点、Yes/No回避、JSONのみ出力）

4. **日本語対応**
   - プロンプト・エラーメッセージ・UI表示はすべて日本語

### 実装結果

#### 1. OpenRouterクライアント (`src/lib/llm/client.ts`)

**`callOpenRouterAPI(params)`**:
- エンドポイント: `https://openrouter.ai/api/v1/chat/completions`
- ヘッダー: `Authorization`, `Content-Type`
- ボディ:
  - `model`: モデル名（例: `openai/gpt-4o-mini`）
  - `messages`: メッセージ配列
  - `response_format`: JSON Schema（オプション）
  - `stream: false`（v1はストリーミングなし）

**エラーハンドリング**:
- `401`: APIキー未設定または無効
- `429`: レート制限超過
- `5xx`: サーバーエラー
- カスタムエラー型: `Error & { statusCode, errorType }`
- タイプガード関数: `isOpenRouterError()`

#### 2. スキーマ定義 (`src/lib/llm/schemas.ts`)

**`InitialGenerateOutputSchema`**:
```typescript
{
  guidelines: string[];  // 5-10個
  tree: Array<{
    type: "heading" | "question" | "note"
    title?: string;
    question?: string;
    text?: string;
    children?: TreeNodeOutput[];  // 再帰的スキーマ
  }>
}
```

**`ReconstructOutputSchema`**:
```typescript
{
  reconstructedText: string
}
```

**`FollowupGenerateOutputSchema`**:
```typescript
{
  newQuestions: Array<{
    question: string
    parentId: string | null  // 既存ノードID or null（ルート）
  }>
}
```

**ポイント**:
- 初期ツリーの`children`は再帰的スキーマ（階層構造を正しく検証）
- Zodの`discriminatedUnion`でノードタイプを安全に区別
- `zod-to-json-schema`でJSON Schemaに変換してOpenRouterに送信

#### 3. プロンプトテンプレート (`src/lib/llm/prompts.ts`)

**`buildInitialGeneratePrompt(theme, description)`**:
- System: 「議論を網羅するための設計者」
- User:
  - テーマ、追加説明を埋め込み
  - 要件: 観点5〜10個、初期ツリー作成、具体的な質問
  - 出力形式: JSONのみ

**`buildReconstructPrompt(question, answer)`**:
- System: 「文章を簡潔に要約する専門家」
- User:
  - 質問、回答を埋め込み
  - 要件: 簡潔な1文、「要点: 内容」形式
  - 出力形式: JSONのみ

**`buildFollowupGeneratePrompt(theme, description, guideline, workspaceMarkdown, count)`**:
- System: 「議論を深めるための質問を生成する専門家」
- User:
  - テーマ、追加説明、質問生成指針、現在のワークスペース（ID付き）を埋め込み
  - 要件: 新規質問N個、重複回避、1質問1論点
  - 出力形式: JSONのみ

**共通方針**:
- 1質問1論点
- Yes/Noで終わらない聞き方
- 前提/制約/具体例/評価軸/代替案/リスク/次アクションを意識
- 出力はJSONのみ（コードフェンス禁止）

#### 4. LLM APIラッパー (`src/lib/llm/api.ts`)

**`generateInitialTree(theme, description, apiKey, model)`**:
- プロンプト構築 → API呼び出し → Zodバリデーション
- 構造化出力: JSON Schema

**`generateReconstructedText(question, answer, apiKey, model)`**:
- Q+A → 要約生成
- 構造化出力: JSON Schema

**`generateFollowupQuestions(theme, description, guideline, workspaceMarkdown, count, apiKey, model)`**:
- 現在のワークスペースをコンテキストとして追加質問生成
- LLMが`parentId`で既存ノードへの紐付けを判断
- 構造化出力: JSON Schema

**`parseJSON(content, schema)`**:
- JSONパース + Zodバリデーション
- エラー時: 詳細なエラーメッセージを投げる

---

## 技術的ポイント

### 1. 型安全性の徹底
- Union型でノードタイプを区別
- Zodで外部入力（LLM出力）を厳密に検証
- `addNode`の引数をUnion型で定義し、各タイプの必須プロパティを強制

### 2. パフォーマンス最適化
- データはフラットに管理（ツリー構造は表示時のみ構築）
- LLMコンテキストの回答文字数制限（200字）
- `buildTree`の計算量はO(n)

### 3. データ永続化
- localStorageを利用（Zustand persist）
- バージョン管理（v1）で将来のマイグレーション対応
- UI状態は永続化しない（ストレージ肥大化回避）

### 4. エラーハンドリング
- OpenRouter APIのHTTPステータスコードに応じたエラー処理
- JSONパースエラーの詳細なメッセージ
- トースト通知でユーザーにフィードバック

### 5. 再利用性
- ドメインロジックは純粋な関数として実装
- プロンプトテンプレートは再利用可能な形で定義
- 設定はコード化（マジックナンバー排除）

---

## クオリティと検証

### 1. 静的解析
- **ESLint**: すべてのルール通過
- **TypeScript**: `strict: true`下で型エラーなし
- **Zodスキーマ**: 再帰的スキーマで階層構造を正しく検証

### 2. 実行時検証
- **Build**: `vite build` 成功
  - 29モジュール変換
  - バンドルサイズ: 193.24 KB（gzip: 60.64 KB）

### 3. 実装ガイドラインとの整合性
- 設計書に記載された全ての要件を満たしているか確認
- Phase 1-4のスコープを逸脱していないか確認

---

## 今後の展開

### Phase 5: アプリ設定画面
- OpenRouter API Key入力
- モデル選択（プリセット + 自由入力）
- 接続テスト機能

### Phase 6: ワークスペース一覧画面
- カード一覧表示
- 新規作成モーダル
- 作成・削除・設定への導線

### Phase 7: ワークスペースメイン画面
- ツリービュー描画
- ノードの編集・削除
- ヘッダー・フッターUI

### Phase 8: D&D並び替え
- dnd-kitの実装
- 同一親内の並び替え

### Phase 9: LLM機能の統合
- 初期ツリー生成（`createWorkspaceWithLLM`アクション追加）
- 再構成機能
- 追加質問生成（自動挿入）

### Phase 10: ワークスペース設定画面
- テーマ・追加説明・質問生成指針の編集
- エクスポート機能

### Phase 11: UI/UX改善
- ローディング表示
- エラーハンドリング
- 追加質問のハイライト

---

## 総括

Phase 1-4では、アプリケーションの技術的基盤を確立しました。

**成果**:
- ✅ TypeScriptでの厳密な型定義
- ✅ 再利用可能なドメインロジック（ツリー操作/Markdown変換/並び替え）
- ✅ localStorage永続化を持つZustand Store
- ✅ OpenRouter API連携基盤（構造化出力対応）
- ✅ 日本語対応のプロンプトテンプレート

**品質**:
- ✅ ESLint通過
- ✅ TypeScript厳密モード通過
- ✅ ビルド成功

Phase 5以降で、これらの基盤を活用しつつ、画面実装・D&D・LLM統合を進めていきます。
