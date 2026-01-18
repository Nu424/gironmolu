## ぎろんもーる（gironmolu）

テーマを入力すると、LLM が「議論の観点」と「質問ツリー」を自動生成し、回答・再構成・追加質問で深掘りしていける **フロント完結のノートツール** です（BYOK: Bring Your Own Key）。

- **LLM**: OpenRouter（ブラウザから直接呼び出し）
- **保存先**: `localStorage`（キー: `gironomall:v1`）
- **ルーティング**: `HashRouter`（GitHub Pages 等の静的ホスティング向け）

---

## 目次

- [特徴](#特徴)
- [クイックスタート](#クイックスタート)
- [使い方](#使い方)
- [データ保存・エクスポート/インポート](#データ保存エクスポートインポート)
- [設定（OpenRouter）](#設定openrouter)
- [技術スタック](#技術スタック)
- [ディレクトリ構成](#ディレクトリ構成)
- [制約・注意点](#制約注意点)
- [デプロイ（GitHub Pages）](#デプロイgithub-pages)

---

## 特徴

- **初期ツリー生成（LLM）**: ワークスペース作成時に、観点（5〜10）＋見出し/質問のツリーを生成
- **ノード編集**: `question` / `heading` / `note` を手動追加・編集
- **再構成（LLM）**: 質問＋回答から、要点の1文（再構成テキスト）を生成
- **追加質問（LLM）**:
  - ワークスペース全体に対して追加質問を生成（ルート追加）
  - 特定ノードを起点に追加質問を生成（配下を優先）
  - 追加された質問は自動挿入＆一時ハイライト
- **回答補助（LLM）**: 既存メモ/回答から推測できる範囲で、空欄の回答を短く補助入力
- **D&D並び替え**: 同一親（siblings）内でドラッグして順序変更
- **折りたたみ**: ノードの展開/折りたたみ、全展開/全折りたたみ
- **エクスポート**: Markdown / JSON（コピーボタン）
- **インポート**: JSON を貼り付けて復元（v1形式）

---

## クイックスタート

### 前提

- Node.js **18+**（GitHub Actions も 18 を使用）
- npm（`package-lock.json` 同梱）

### 起動

```bash
npm ci
npm run dev
```

起動後、ブラウザで Vite の表示する URL（通常 `http://localhost:5173`）を開きます。

### 最初にやること（APIキー設定）

1. 画面右上の **「アプリ設定」** を開く
2. **OpenRouter API Key** を入力
3. モデルを選択して **保存**

OpenRouter のキー発行ページ: `https://openrouter.ai/keys`

---

## 使い方

### ワークスペース作成（初期ツリー生成）

1. 一覧で **「新規作成」**
2. テーマ（必須）と追加説明（任意）を入力
3. **作成** → 生成中 → 完了するとワークスペース画面へ遷移

### ノードの種類

- **question**: 質問 / 回答 / 再構成テキスト
- **heading**: 見出し（配下にノードをぶら下げる）
- **note**: メモ

### よく使う操作（ワークスペース画面）

- **追加質問生成（LLM）**: ワークスペース全体の文脈から追加質問を生成
- **ルートに追加**: `question` / `note` / `heading` をルート直下に追加
- **並び替え**: 各行のドラッグハンドル `⋮⋮` をつかんで、同一階層内で並び替え
- **質問ノード**
  - **再構成**: 回答があるときに実行可能（要点1文を生成）
  - **質問を追加（LLM）**: そのノードを起点に追加質問を生成
  - **回答補助**: 回答が空のとき、既存内容から補助入力（短文）

---

## データ保存・エクスポート/インポート

### 保存（localStorage）

- ブラウザの `localStorage` に保存します（キー: `gironomall:v1`）
- APIキーも同じく `localStorage` に保存されます（後述の注意点を参照）

### エクスポート

ワークスペース設定画面（`/#/workspaces/:workspaceId/settings`）で、以下をコピーできます。

- **Markdown**: 共有・文章化向け（IDなし）
- **JSON**: バックアップ/復元向け（v1形式）

### インポート

一覧画面の **「新規ワークスペース」モーダル下部** に、JSON を貼り付けて **インポート** します。

---

## 設定（OpenRouter）

### どこで設定する？

`/#/settings`（一覧画面の **「アプリ設定」**）から設定します。

### モデル

プリセット例:

- `openai/gpt-4o-mini`（デフォルト）
- `google/gemini-2.5-flash`
- `anthropic/claude-sonnet-4`

任意のモデル名を手入力（カスタム）もできます。

---

## 技術スタック

- **Frontend**: React 19 + TypeScript
- **Build**: Vite
- **Routing**: `react-router-dom`（`HashRouter`）
- **State**: Zustand（persist + `localStorage`）
- **UI**: Tailwind CSS
- **D&D**: dnd-kit
- **LLM**: OpenRouter（`response_format: json_schema` を使用）
- **Schema**: Zod（LLM出力の検証）

---

## ディレクトリ構成

```txt
src/
  app/                         # ルーティング/アプリ起点
  components/                  # Modal/Toast など共通部品
  features/
    settings/                  # アプリ設定（OpenRouter）
    workspaces/                # ワークスペース/ツリー編集
      pages/                   # 一覧/詳細/設定
      components/              # TreeView / NodeRow
      domain/                  # tree/markdown/import-export/ordering
  lib/llm/                      # OpenRouter client + prompts + schemas
  stores/                       # persistStore/uiStore
  types/                        # ドメイン型
```

---

## 制約・注意点

### APIキーの取り扱い（重要）

- OpenRouter の API キーは **ブラウザの localStorage に保存** されます。
- 共有PCや公開端末では使用しないでください。
- 本プロジェクトは **フロント完結** のため、キーを完全に秘匿することはできません（一般に「ブラウザから直接 API を叩く」方式の制約です）。

### GitHub Pages の `base` 設定について

このアプリはルーティングに `HashRouter` を使っているため、パス解決は安定します。一方で GitHub Pages の **Project Pages**（`https://<user>.github.io/<repo>/`）では、Vite の `base` 設定次第で静的アセットの参照が崩れる場合があります。

- 必要に応じて `vite.config.ts` の `defineConfig({ base: ... })` を調整してください
  - 例: `base: "/<repo>/"` または `base: "./"`

### LLM文脈のサイズ

- 追加質問生成で LLM に渡す Markdown では、回答は **先頭200文字で省略** します（トークン肥大の予防）

---

## デプロイ（GitHub Pages）

`.github/deploy.yml` により、`main` への push をトリガーに GitHub Pages へデプロイします。

- **Build**: `npm ci` → `npm run build`
- **Artifact**: `./dist`

GitHub の Pages 設定は「**Source: GitHub Actions**」を選択してください。
