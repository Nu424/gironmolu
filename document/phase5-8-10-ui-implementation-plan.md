# Phase 5–8, 10 UI 実装プラン（LLM機能は後回し）

## 目的
Phase 1–4 で整備済みの **Domain / Store / LLM基盤** を前提に、Phase 5–8, 10 の **画面とUI（手動操作中心）** を実装し、LLM統合（Phase 9）に耐える形でアプリの骨格を完成させる。

- 対象: **UI実装（画面・コンポーネント・ルーティング・入力/編集体験）**
- 対象外: **LLM実行（初期生成/再構成/追加質問生成）**
  - ただし UI 上のボタンは表示し、**disabled** とする

## 事前に確定した方針（ユーザー合意）
- LLMボタンは **表示して disabled**（Phase 9で有効化予定）
- 新規ワークスペースは **空で作成**（初期ツリー生成なし）
- APIキー未設定でも **ワークスペース作成は可能**（A）
- ノード編集は **onBlur 保存**（入力中はローカル state）

## 現状（Phase 1–4）
- 実装済み
  - ドメイン: `src/features/workspaces/domain/*`（tree/markdown/ordering）
  - Persist store: `src/stores/persistStore.ts`（workspace/node CRUD、reorder）
  - UI store: `src/stores/uiStore.ts`（toast/expanded/busy）
  - LLM基盤: `src/lib/llm/*`（OpenRouterクライアント/スキーマ/プロンプト/ラッパー）
- 未実装
  - ルーティング（HashRouter）
  - 各画面（ワークスペース一覧/メイン/設定/アプリ設定）
  - TreeView / NodeRow 系 UI
  - D&D（dnd-kit）

## 実装全体方針
1. **HashRouter で画面遷移を確定**し、各ページを配置する
2. 共通UI（最低限）: **レイアウト/トースト/モーダル** を先に用意する
3. 画面実装は設計書の順に: **App設定 → 一覧 → メイン → D&D → WS設定**
4. 入力は **onBlur で persistStore に反映**（過剰なlocalStorage書き込みを避ける）
5. LLM関連 UI は「将来の導線」として表示するが、**必ず disabled** + 文言で補足

## 画面・ルーティング（必須）
設計書（`document/plan.md`）のルーティング案に合わせる。

- `/#/` ワークスペース一覧
- `/#/workspaces/:workspaceId` ワークスペースメイン
- `/#/workspaces/:workspaceId/settings` ワークスペース設定
- `/#/settings` アプリ設定

実装予定ファイル
- 追加: `src/app/router.tsx`（HashRouter + Routes）
- 更新: `src/app/App.tsx`（Hello World → Routerを描画）

## 共通UI（先に作る）
### トースト
- `useUIStore.toast` を購読し、画面下部などに簡易表示
- close（×）または自動dismissは最低限でOK（後で改善可能）

### モーダル
- ワークスペース新規作成（Phase 6）で使用
- Tailwindで簡易実装

### 404 / NotFound
- 存在しない `workspaceId` 等でのフォールバック

---

## Phase 5: アプリ設定画面（UIのみ）
### 目標
OpenRouterキー・モデルを編集できるようにし、Phase 9 で LLM を呼べる状態にしておく。

### 画面要件
- API Key: password input
- モデル: プリセット選択 + 自由入力
  - 例: `openai/gpt-4o-mini`, `google/gemini-2.5-flash`, `anthropic/claude-sonnet-4`
- 接続テスト
  - Phase 9 で実装予定のため **ボタン表示のみ（disabled）**

### Store差分
- `persistStore` に **appSettings 更新アクション**を追加（現状は更新手段がない）
  - 例: `updateAppSettings(partial)`

実装予定ファイル
- 追加: `src/features/settings/pages/AppSettingsPage.tsx`（ディレクトリは新設）
- 更新: `src/stores/persistStore.ts`

---

## Phase 6: ワークスペース一覧/追加（LLMなし）
### 目標
- ワークスペースの一覧表示
- 削除
- 新規作成（空で作成）
- メイン/設定への導線

### 一覧UI
- カード表示: テーマ / 更新日時 / 進捗
- 進捗の定義（v1）
  - `question` ノード総数
  - `answer` が非空の `question` 数
  - 表示例: `3/10 回答済み`

### 新規作成モーダル
- 入力
  - テーマ（必須）
  - 追加説明（任意）
- 作成時
  - APIキー有無に関わらず作成可能（合意済み）
  - guidelineText は空 or 軽いテンプレを入れる（運用しやすさ優先）
  - followupCount は 3
  - ノードは作らず空スタート

実装予定ファイル
- 追加: `src/features/workspaces/pages/WorkspaceListPage.tsx`
- 追加: `src/features/workspaces/components/CreateWorkspaceModal.tsx`（またはページ内実装でも可）

---

## Phase 7: ワークスペースメイン画面（ツリー編集）
### 目標
- ツリー表示（インデント）
- ノードの追加（手動）/編集（onBlur保存）/削除（カスケード）
- 折りたたみ（expanded）
- 右上アクションの配置（LLMはdisabled）

### ヘッダー
- テーマ表示
- 追加説明は任意表示（折りたたみ可）
- 右上アクション
  - ルートに追加質問生成（LLM）: **disabled**
  - ルートに手動追加（+）: type選択して追加
  - 設定へ: WorkspaceSettingsPageへ

### TreeView / NodeRow
- TreeView は `buildTree()` を利用して描画
- 表示は「行」ベース + インデント（2スペース相当）
- 各ノードタイプ
  - heading: title編集
  - note: text編集
  - question
    - question編集
    - answer textarea（onBlur保存）
    - reconstructedText textarea（onBlur保存）
    - ボタン
      - 再構成（LLM）: disabled
      - 質問を追加（LLM）: disabled
      - 子を追加（手動）: type選択
      - 削除

### onBlur保存の実装指針
- 入力中はローカルstate（`useState`）
- `onBlur` 時点で `persistStore.updateNode()` を呼ぶ
- 値が変わっていない場合は update を呼ばない（無駄な updatedAt 更新を避ける）

実装予定ファイル
- 追加: `src/features/workspaces/pages/WorkspacePage.tsx`
- 追加: `src/features/workspaces/components/TreeView.tsx`
- 追加: `src/features/workspaces/components/NodeRow/QuestionRow.tsx`
- 追加: `src/features/workspaces/components/NodeRow/HeadingRow.tsx`
- 追加: `src/features/workspaces/components/NodeRow/NoteRow.tsx`

---

## Phase 8: D&D 並び替え（siblings内のみ）
### 目標
- dnd-kit で **同一親の siblings のみ** 並び替え
- 並び替え結果を `persistStore.reorderSiblings()` に反映

### 実装方針
- `TreeView` 内で親ごとに `SortableContext` を分ける
- `onDragEnd` で
  - 同一 parentId のときのみ reorder
  - parentが違うドロップは無視（v1仕様）
- order は `reorderSiblings()` が 0..n-1 に振り直す

実装予定ファイル
- 更新: `src/features/workspaces/components/TreeView.tsx`

---

## Phase 10: ワークスペース設定画面 + エクスポート
### 目標
- workspaceメタ情報の編集
- Markdownエクスポート（IDなし）+ コピー

### UI要件
- 編集
  - テーマ
  - 追加説明
  - 質問生成指針（複数行）
  - 追加質問数（number、デフォルト3）
- エクスポート
  - `workspaceToMarkdown(workspace, nodes)` で textarea 表示
  - コピーボタン（`navigator.clipboard.writeText`）

### Store差分（推奨）
一覧の「更新日時」を正しくするため、次のどれかを実施する。
- (推奨) `updateNode()` で該当 workspace の `updatedAt` も更新する
- 代替: ページ側でノード更新時に `updateWorkspace({ id, updatedAt: Date.now() })` も呼ぶ

実装予定ファイル
- 追加: `src/features/workspaces/pages/WorkspaceSettingsPage.tsx`
- 更新: `src/stores/persistStore.ts`（必要に応じて）

---

## LLMボタン（disabled）に関するUI仕様
- 表示はする（合意済み）
- 押せない理由をユーザーに伝える（例）
  - ボタン横に「（Phase 9で実装予定）」
  - または `title` 属性でツールチップ

## 受け入れ条件（Done定義）
- HashRouterで4画面に遷移できる
- APIキー無しでもワークスペース作成できる
- ワークスペースメインでノードを追加/編集(onBlur)/削除できる
- 折りたたみが動作する
- siblings内D&Dが動作し、並び順が永続化される
- WS設定でMarkdownエクスポートとコピーができる
- LLM関連ボタンは表示されるが **常にdisabled**

## 実装後の動作確認コマンド
- `npm run lint`
- `npm run build`
- `npm run dev`（手動確認）
