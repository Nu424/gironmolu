# Phase 5–8, 10 UI 実装サマリー

## 背景・目的
Phase 1–4 で整備されたドメイン/Store/LLM基盤を土台に、Phase 5–8, 10 のUIを先行実装し、LLM統合（Phase 9）に耐える操作フローと画面遷移を完成させる。

- 対象: 画面UI、ルーティング、手動編集、D&D、設定/エクスポート
- 対象外: LLM実行（ボタンは表示するが disabled）

## 実装方針
- **HashRouter** による画面遷移を先に固定し、各ページを分離
- LLMボタンは将来の導線として **表示のみ（disabled）**
- ワークスペース作成は **空から開始**（LLMなし）
- ノード編集は **onBlur保存**（過剰な永続化を避ける）
- 並び替えは **同一親内のみ**（dnd-kit）
- 更新日時は「追加/削除/並び替え/編集」すべてで更新

## 実装結果（主要ポイント）

### 1. ルーティングと共通UI
- `/#/` ワークスペース一覧
- `/#/workspaces/:workspaceId` メイン
- `/#/workspaces/:workspaceId/settings` 設定
- `/#/settings` アプリ設定

共通コンポーネント
- トースト表示
- モーダル

### 2. Phase 5: アプリ設定画面
- APIキー入力（password）
- モデル選択（プリセット + カスタム）
- 接続テストは disabled 表示
- 一覧からの導線を追加

### 3. Phase 6: ワークスペース一覧/追加
- カード表示（テーマ/説明/更新日時/進捗）
- 空状態UI
- 新規作成モーダル（テーマ必須、追加説明任意）
- 削除確認

### 4. Phase 7: メイン画面・ツリー編集
- ヘッダー（テーマ/説明） + 設定導線
- ルート追加（question/note/heading 選択）
- ノード行（question/heading/note）
  - onBlur保存
  - 子追加のタイプ選択
  - 削除（カスケード）
  - 折りたたみ

### 5. Phase 8: D&D 並び替え
- dnd-kit による siblings 内並び替え
- ドラッグハンドルを行ごとに配置
- 並び替え結果は `reorderSiblings` で永続化

### 6. Phase 10: ワークスペース設定 + エクスポート
- テーマ/説明/指針/追加質問数の編集
- Markdownエクスポート + コピー

## 主要な修正点（レビュー反映）
- ツリー再帰の破綻を修正（子ノードが表示されない問題）
- D&Dが動かない原因（`useSortable`未適用）を解消
- ルート/子追加のタイプ選択を追加
- App設定のカスタムモデル選択バグを修正
- updatedAt を追加/削除/並び替え/編集で更新
- App設定画面の導線追加
- 数値入力（追加質問数）の NaN ガード追加

## 関連ファイル
- ルーティング: `src/app/router.tsx`
- 一覧: `src/features/workspaces/pages/WorkspaceListPage.tsx`
- メイン: `src/features/workspaces/pages/WorkspacePage.tsx`
- 設定: `src/features/workspaces/pages/WorkspaceSettingsPage.tsx`
- アプリ設定: `src/features/settings/pages/AppSettingsPage.tsx`
- ツリー/行UI: `src/features/workspaces/components/TreeView.tsx`, `src/features/workspaces/components/NodeRow/*`
- Store: `src/stores/persistStore.ts`

## 補足（Phase 9以降に備えた設計）
- `addNode` は `origin` を受け取れる形に拡張（LLM追加時に「llm」指定が可能）
- LLMボタンは全画面で視認可能だが disabled

## 次のフェーズでの想定作業
- Phase 9: LLM機能の統合（初期生成/再構成/追加質問）
- 追加質問のハイライト、折りたたみUX
- ローディング/エラーの視覚改善（toast/ボタン状態）
