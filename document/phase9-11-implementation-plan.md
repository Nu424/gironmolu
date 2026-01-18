# Phase 9-11 実装計画（LLM機能統合 + UX改善）

## 前提（今回確定した方針）
- ワークスペース作成は LLM必須（APIキー未設定なら作成不可＋設定へ誘導）
- 「質問を追加（LLM）」は起点ノードを優先（LLM出力のparentIdを検証しつつ採用）
- 追加質問ハイライトは数秒で消える
- 折りたたみのデフォルトはルートだけ展開
- App設定の接続テスト（LLM）も今回実装

---

## 現状整理（As-Is）
- LLM基盤は実装済み
  - `src/lib/llm/api.ts`
  - `src/lib/llm/client.ts`
  - `src/lib/llm/prompts.ts`
  - `src/lib/llm/schemas.ts`
- Persist StoreはUI先行でLLM統合が未実装
  - `src/stores/persistStore.ts`（`createWorkspace`のみ）
- UIのLLM導線は表示のみ（disabled）
  - 一覧作成: `src/features/workspaces/pages/WorkspaceListPage.tsx`
  - ルート追加質問: `src/features/workspaces/pages/WorkspacePage.tsx`
  - 再構成/追加質問: `src/features/workspaces/components/NodeRow/QuestionRow.tsx`
- UX用UI stateは用意済み
  - `src/stores/uiStore.ts`（`creatingWorkspace`, `nodeBusy`, `rootBusyByWorkspace`, `toast`, `expanded`）

---

## 実装計画（Phase 9 + 11）

### 1) 共通: LLM実行のガード & エラーメッセージ統一
目的: 例外処理を統一し、トースト表示を一貫させる
- `isOpenRouterError()` で例外種別を分類し、UI向けメッセージに変換するユーティリティを用意
- 推奨メッセージ
  - 401: APIキーが無効/未設定
  - 429: レート制限
  - 5xx: OpenRouter側エラー
  - JSON parse failed: LLM出力解析失敗

### 2) Phase 9.1: ワークスペース作成時の初期ツリー生成
目的: 空作成から LLM初期生成へ置換
- Store拡張
  - `createWorkspaceWithLLM()` を `persistStore` に追加（async）
  - `generateInitialTree()` で指針 + ツリー取得
  - 指針は `formatGuidelines()` で `guidelineText` へ整形
- 初期ツリー（階層）→ TextNode（フラット）変換関数を新規追加
  - 設計書想定 `flattenTree` が未実装のため、ドメイン関数として追加
  - 再帰で siblings order を index 付与
  - `origin: "llm"` を付与
- UI修正
  - `WorkspaceListPage` で `createWorkspaceWithLLM` を使用
  - APIキー未設定時は作成ボタンを無効化し、設定導線を表示
  - `creatingWorkspace` で生成中表示

### 3) Phase 9.3: 追加質問生成（ルート/ノード起点）+ 自動挿入
目的: LLM出力を安全に取り込み、末尾に挿入
- プロンプト整備
  - `parentId` は「括弧なしのID」と明記
  - ノード起点時は起点配下を優先する指示を明記
- 取り込み処理
  - `workspaceToMarkdownForLLM()` で文脈生成
  - `parentId` を正規化（括弧除去・存在チェック・workspace一致検証）
  - 不正/他workspaceなら `null` にフォールバック
  - 追加は `addNode({ origin: "llm" })`
- UI実装
  - `WorkspacePage` のルート追加質問ボタンを有効化
  - `QuestionRow` の「質問を追加（LLM）」を有効化

### 4) Phase 9.2: 再構成 → 追加質問生成
目的: 回答→要約→深掘り質問追加を1クリックで連続実行
- `QuestionRow` で実装
  - answer空なら再構成ボタンをdisabled
  - `generateReconstructedText()` → `updateNode({ reconstructedText })`
  - 続けて `generateFollowupQuestions()` を実行し追加質問を挿入
- `nodeBusy` によるローディング制御

---

## Phase 11（UX改善）

### 5) 11.1 ローディング状態
- 作成中: `creatingWorkspace`
- ルート質問生成: `rootBusyByWorkspace`
- ノード操作: `nodeBusy`
- それぞれボタン文言・disabled状態を連動

### 6) 11.2 エラーハンドリング
- 共通のエラーメッセージ変換ユーティリティを導入
- `showToast("error", message)` のみでUIを構成

### 7) 11.3 追加質問ハイライト + 折りたたみデフォルト
- ハイライト
  - `uiStore` に `highlighted` と `flashHighlight()` を追加
  - 追加質問挿入時に数秒間ハイライト
- 折りたたみデフォルト
  - depth=0 のノードを初期展開
  - 追加質問挿入時に親〜祖先を `setExpanded(true)` で展開

---

## App設定: 接続テスト（LLM）
- `AppSettingsPage` の接続テストボタンを実装
- 短いプロンプトで1回呼び出し
- 成功/失敗をトースト表示

---

## 動作確認（最小の受け入れ条件）
- APIキー未設定時
  - 新規作成ボタン無効・設定導線あり
  - ルート/ノードのLLMボタンも無効
- APIキー設定後
  - 新規作成で初期ツリー生成
  - 再構成 → 追加質問が挿入され、数秒ハイライト
  - ルート追加質問生成・ノード起点追加質問生成が動作

---

## 実装順の推奨
1. Phase 9.1: 初期生成 + flattenTree + createWorkspaceWithLLM
2. Phase 9.3: 追加質問生成 + 自動挿入 + parentId正規化
3. Phase 9.2: 再構成 → 追加質問連鎖
4. Phase 11: ローディング・エラー統一・ハイライト/展開
5. App設定: 接続テスト実装
