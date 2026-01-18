# Phase 9-11 実装サマリー（LLM機能統合 + UX改善）

## 背景・目的

Phase 5–8, 10 でUIと画面遷移は先行実装できていた一方、コア価値である **LLMによる「初期生成 → 回答 → 再構成 → 深掘り質問」** が未統合でした（ボタンは表示されるが disabled）。

本フェーズ（9–11）の目的は次の3点です。

- **Phase 9**: LLM呼び出し・プロンプト・スキーマなど「LLM機能の実行基盤」を整える
- **Phase 10**: Persist/UI Store にLLMを統合し、データ変換（LLM出力→ノード追加）をアプリ側の責務として確立する
- **Phase 11**: UIを有効化し、ガード・ローディング・ハイライト・展開などのUXを仕上げる

## 前提（今回確定した方針）

- ワークスペース作成は **LLM必須**（APIキー未設定なら作成不可 + 設定へ誘導）
- 「質問を追加（LLM）」は **起点ノードを優先**（LLMの `parentId` は検証しつつ採用）
- 追加質問のハイライトは **数秒で消える**
- 折りたたみのデフォルトは **ルートのみ展開**（必要なときだけ祖先を自動展開）
- App設定の **接続テスト（LLM）** も今回実装

## 実装方針（全体）

- **UIは薄く、Storeに寄せる**
  - LLM実行・ノード挿入・`parentId`正規化はPersist Store側に集約
  - UIは「押されたらアクション呼ぶ」「busy/expanded/highlightを反映」の責務に限定
- **失敗時の体験を統一**
  - OpenRouterのHTTPエラー（401/429/5xx）やJSONパース失敗を、ユーザー向け文言へ変換してToast表示
- **LLM出力は信用しすぎない**
  - `parentId` は workspace一致・存在チェックを行い、不正ならフォールバック
  - 起点ノード指定がある場合は、`parentId` が不正/未指定でも起点に紐づくようにする

---

## Phase 9: LLMコアAPI実装

### 背景・目的
- UI実装は進んだが、LLM実行時のエラーや出力ブレによりUXが崩れる可能性が高い
- 追加質問生成では「どこに紐づけるか（`parentId`）」が重要で、起点指定が必要

### 実装方針
- OpenRouterエラーをUI向けに変換する `toUserFriendlyError()` を導入
- 追加質問生成に **起点指定（`originNodeId`）** を追加し、プロンプトにも反映
- 初期ツリーの再帰構造を型として表現できるよう、スキーマの再帰型定義を整理

### 実装結果
- `src/lib/llm/api.ts`
  - `toUserFriendlyError(err)` を追加（401/429/5xx/JSON parse failed等を日本語化）
  - `generateFollowupQuestions(..., originNodeId?)` を追加（起点指定対応）
- `src/lib/llm/prompts.ts`
  - `buildFollowupGeneratePrompt(..., originNodeId?)` を追加
  - `parentId` の指定ルールを明確化（`[xxxx]` ではなく **括弧なしID**）
- `src/lib/llm/schemas.ts`
  - 初期ツリー用の再帰的型（`TreeNodeOutput`）を明確化

**コミット**: `63390fd`（feat: LLMコアAPI実装（Phase 9））

---

## Phase 10: ストア層のLLM統合

### 背景・目的
- LLM出力（初期ツリー/追加質問）をアプリ内データ（ノード）に反映する責務を確立し、UI側の分岐・重複を減らす
- 新規追加質問を「見える状態」にするため、折りたたみ・ハイライトの状態管理が必要

### 実装方針
- Persist Storeに「LLMを使った作成/生成」を **async action** として追加
- LLM出力の `parentId` は、存在/別workspace/括弧形式などを正規化
- UI Storeにハイライト用stateを追加し、時間経過で自動解除する

### 実装結果
- `src/stores/persistStore.ts`
  - `createWorkspaceWithLLM(theme, description)`
    - `generateInitialTree()` を呼び、指針を `formatGuidelines()` で `guidelineText` 化
    - LLMの階層ツリーを再帰でノード追加（`origin: "llm"`、`order`付与）
  - `generateFollowupQuestionsForWorkspace(workspaceId, originNodeId?)`
    - `workspaceToMarkdownForLLM()` でコンテキスト生成
    - `parentId` を正規化して安全にノード追加（不正なら `originNodeId` へフォールバック）
    - 新規ノードID群（`nodeIds`）と、祖先を含む展開対象ID群（`expandIds`）を返却
  - `testConnection({ apiKey, model })`
    - 短い再構成呼び出しで疎通確認（成功/失敗を返す）
- `src/stores/uiStore.ts`
  - `highlighted` と `flashHighlight(nodeIds, durationMs)` を追加
- `src/features/workspaces/domain/tree.ts`
  - `InitialTreeNode` 型をエクスポート（初期ツリー取り込み用）

**コミット**: `d61a072`（feat: ストア層のLLM統合（Phase 10））

---

## Phase 11: UIコンポーネントのLLM統合とUX改善

### 背景・目的
- LLM機能が動いても「どこに追加されたかわからない」「押しても反応がない」「APIキー未設定で失敗」などで体験が崩れやすい
- 作成/生成/再構成の一連フローを、ユーザー操作として自然に繋げる必要がある

### 実装方針
- 各画面のLLMボタンを有効化し、APIキーガード・ローディング・成功/失敗トーストを統一
- 追加質問挿入時は
  - 祖先ノードを自動展開して可視化
  - 新規ノードを一定時間ハイライト
- 再構成は「再構成→追加質問生成」を1クリックで連鎖実行

### 実装結果
- `src/features/workspaces/pages/WorkspaceListPage.tsx`
  - 新規作成を `createWorkspaceWithLLM` に置換
  - APIキー未設定時は作成ボタン無効 + 設定導線
  - 生成中表示（`creatingWorkspace`）
- `src/features/workspaces/pages/WorkspacePage.tsx`
  - ルート「追加質問生成（LLM）」を有効化（APIキーガード、`rootBusyByWorkspace`）
  - 初期ロード時にルートノードを自動展開
  - 追加質問挿入時は `expandIds` 展開 + `flashHighlight`
- `src/features/workspaces/components/NodeRow/QuestionRow.tsx`
  - 「再構成」実装（回答必須、busy制御）
  - 再構成成功後に追加質問生成を連鎖実行
  - 「質問を追加（LLM）」実装（ノード起点、APIキーガード）
  - 追加質問挿入時に `expandIds` 展開 + `flashHighlight`
- `src/features/settings/pages/AppSettingsPage.tsx`
  - 接続テストボタンを有効化（入力中の `apiKey`/`model` で実行）
  - 成否をToast表示
- `src/features/workspaces/components/TreeView.tsx`
  - ハイライトのCSS遷移を追加（`transition-colors`）
- `src/features/workspaces/pages/WorkspaceSettingsPage.tsx`
  - UI文言から「Phase 9で実装予定」を削除（実装完了の反映）

**コミット**: `59762af`（feat: UIコンポーネントのLLM統合とUX改善（Phase 11））

---

## 動作確認（最小の受け入れ条件）

- APIキー未設定時
  - ワークスペース新規作成が無効化され、設定への導線が表示される
  - ルート/ノードのLLMボタンが無効化され、設定導線が表示される
- APIキー設定後
  - 新規作成で初期ツリーが生成され、メイン画面へ遷移できる
  - 再構成→追加質問が挿入され、数秒ハイライトされる
  - ルート追加質問生成/ノード起点追加質問生成が動作し、必要な祖先が自動展開される

## 関連ファイル

- LLM: `src/lib/llm/api.ts`, `src/lib/llm/prompts.ts`, `src/lib/llm/schemas.ts`
- Store: `src/stores/persistStore.ts`, `src/stores/uiStore.ts`
- UI:
  - 一覧: `src/features/workspaces/pages/WorkspaceListPage.tsx`
  - メイン: `src/features/workspaces/pages/WorkspacePage.tsx`
  - 質問行: `src/features/workspaces/components/NodeRow/QuestionRow.tsx`
  - ツリー: `src/features/workspaces/components/TreeView.tsx`
  - 設定: `src/features/settings/pages/AppSettingsPage.tsx`
- Domain: `src/features/workspaces/domain/tree.ts`
