# ぎろんもーる v1 設計書（フロント完結 / BYOK）

## 0. 前提・方針（確定事項の反映）
- 利用シーンは広く想定（企画/意思決定/要件定義/内省/振り返り/議事録など）。＝**汎用性を落とさない設計**にする
- 対象言語：日本語固定
- ワークスペース作成直後：**LLMで初期ツリー（質問リスト含む）を生成**
- 質問生成指針：**最適フレームワークを考慮した議論の大枠（5–10個）**を提示・編集可能
- ノード type：`question` / `note` / `heading`
- 並び順：`order` を持ち、**dnd-kitでD&D並び替え**
- 再構成：上書き確認なし（毎回上書き）
- 追加質問生成：**自動で挿入**
- 重複排除：プロンプト指示のみ（ローカル判定なし）
- 深さ制限：なし
- LLM呼び出しのHTTP詳細は別ファイル（本設計書では「IF/入出力/プロンプト/スキーマ」を定義）
- ストリーミングなし
- 保存：localStorage（Zustand persist）
- インポート：不要

---

## 1. 目的・価値（アプリの定義）
「テーマ」を入力すると、AIが議論の観点（指針＋質問）を提示し、ユーザーが回答→要約（再構成）→追加質問で深掘りしていける、**“網羅的でまんべんない言語化”のためのノートツール**。

---

## 2. 機能一覧（MVP）
### ワークスペース
- 作成（テーマ＋追加説明）
- 一覧表示、削除
- 設定（テーマ、追加説明、質問生成指針、追加質問数）
- エクスポート（Markdownをtextarea表示＋コピー）

### ノード（テキストオブジェクト）
- 表示（ツリー）
- 追加（手動：question/note/heading）
- 編集（本文、質問、回答、再構成テキスト）
- 削除（子も含めて削除＝カスケード）
- 並び替え（同一親の子同士の順序変更を基本。※後述）
- LLM
  - 初期ツリー生成（作成時）
  - 再構成生成（questionノード）
  - 追加質問生成（questionノード or ルートで実行）→自動挿入

---

## 3. 画面設計
### 3.1 画面一覧
1. **ワークスペース一覧/追加**  
2. **ワークスペース画面（メイン）**  
3. **ワークスペース設定**  
4. **アプリ設定（OpenRouter）**

### 3.2 画面遷移（ルーティング案）
静的ホスティングも想定し、`HashRouter` 推奨（GitHub Pages等に強い）。

- `/#/` ワークスペース一覧
- `/#/workspaces/new` 作成（一覧内モーダルでもOK）
- `/#/workspaces/:workspaceId` メイン
- `/#/workspaces/:workspaceId/settings` ワークスペース設定
- `/#/settings` アプリ設定

### 3.3 各画面のUI要件
#### (1) ワークスペース一覧
- カード表示：テーマ、更新日時、進捗（回答済み/質問数）
- 操作：開く、設定、削除
- 「新規作成」：テーマ必須、追加説明任意

**作成時のUX**
- APIキー未設定なら「アプリ設定へ誘導」して作成ボタン無効化
- 作成クリック→生成中表示→成功でメインへ遷移、失敗ならエラートースト＋作成画面に留まる

#### (2) ワークスペース画面（メイン）
- ヘッダー：テーマ、（任意で追加説明の表示/折りたたみ）
- 右上アクション：  
  - ルートに追加質問生成（LLM）  
  - ルートに手動追加（+）  
  - 設定へ  
- 本文：ツリー表示（インデント）
  - `heading`：見出し行（太字）
  - `question`：質問（編集可）＋回答textarea＋再構成テキスト（編集可）＋ボタン群
  - `note`：メモ行（編集可）

**questionノードのボタン**
- 「再構成」：Q+A → 再構成生成 → 生成成功後に追加質問生成→自動挿入
- 「質問を追加（LLM）」：そのノード起点で追加質問生成→自動挿入
- 「子を追加（手動）」：question/note/headingを子として追加
- 「削除」

#### (3) ワークスペース設定
- テーマ（編集可）
- 追加説明（編集可）
- 質問生成指針（編集可、複数行テキスト）
- 追加質問の生成個数（number、デフォルト3）
- エクスポート（Markdown textarea＋コピー）
  - ここで「IDsを含めないエクスポート」を基本とする

#### (4) アプリ設定
- OpenRouter API Key（password input）
- 使用モデル
  - プリセットプルダウン + 自由入力
- （任意）簡易接続テスト（「短いプロンプトで1回呼ぶ」）

---

## 4. ドメインモデル（データ設計）
### 4.1 ID方針
- `workspaceId` / `nodeId` は `nanoid()` 等でフロント生成
- LLMのtarget参照は **nodeIdを使う**（コンテキストにIDを含める）

### 4.2 型定義（TypeScript・推奨）
```ts
export type WorkspaceId = string;
export type NodeId = string;

export type NodeType = "question" | "note" | "heading";

export type Workspace = {
  id: WorkspaceId;
  theme: string;
  description?: string; // 追加説明
  guidelineText: string; // 質問生成指針（ユーザー編集可）
  config: {
    followupCount: number; // 追加質問数（default 3）
  };
  createdAt: number;
  updatedAt: number;
};

type NodeBase = {
  id: NodeId;
  workspaceId: WorkspaceId;
  type: NodeType;
  parentId: NodeId | null;
  order: number;          // siblings内の順序
  createdAt: number;
  updatedAt: number;
  origin: "user" | "llm"; // 生成元（任意だが運用上便利）
};

export type QuestionNode = NodeBase & {
  type: "question";
  question: string;
  answer: string;
  reconstructedText: string; // 再構成（編集可）
};

export type NoteNode = NodeBase & {
  type: "note";
  text: string;
};

export type HeadingNode = NodeBase & {
  type: "heading";
  title: string;
};

export type TextNode = QuestionNode | NoteNode | HeadingNode;
```

### 4.3 削除仕様（カスケード）
- ノード削除：そのノード配下（子孫）も全削除
- ワークスペース削除：紐づくノード全削除

---

## 5. 状態管理（Zustand）
### 5.1 Store分割（推奨）
- **PersistするStore（localStorage）**：ワークスペース/ノード/アプリ設定
- **非PersistのUI Store**：ローディング状態、展開状態、トーストなど

（persistにUI状態を混ぜない＝localStorage肥大・バグを回避）

### 5.2 Persist Store（例）
```ts
type AppSettings = {
  openRouterApiKey: string;
  model: string; // 例: "openai/gpt-4o-mini"
};

type PersistState = {
  appSettings: AppSettings;
  workspaceIds: WorkspaceId[];
  workspacesById: Record<WorkspaceId, Workspace>;
  nodesById: Record<NodeId, TextNode>;

  actions: {
    createWorkspaceWithLLM(input: { theme: string; description?: string }): Promise<WorkspaceId>;
    updateWorkspace(ws: Partial<Workspace> & { id: WorkspaceId }): void;
    deleteWorkspace(id: WorkspaceId): void;

    addNode(node: Omit<TextNode, "id" | "createdAt" | "updatedAt" | "order"> & { order?: number }): NodeId;
    updateNode(node: Partial<TextNode> & { id: NodeId }): void;
    deleteNode(id: NodeId): void;

    reorderSiblings(params: { workspaceId: WorkspaceId; parentId: NodeId | null; orderedChildIds: NodeId[] }): void;
  };
};
```

### 5.3 UI Store（例）
```ts
type UIState = {
  creatingWorkspace: boolean;
  nodeBusy: Record<NodeId, "reconstructing" | "generatingFollowups" | undefined>;
  rootBusyByWorkspace: Record<WorkspaceId, boolean>;
  toast?: { kind: "error" | "info"; message: string };

  expanded: Record<NodeId, boolean>; // 折りたたみ（任意）
  actions: { ... }
};
```

---

## 6. ツリー描画（平坦管理→表示時に組み立て）
### 6.1 ツリー組み立て関数
ノードはフラットに保持し、描画時に `parentId` でグルーピング。

```ts
type TreeNode = TextNode & { children: TreeNode[] };

function buildTree(nodes: TextNode[]): TreeNode[] {
  const byParent = new Map<string, TreeNode[]>();
  const byId = new Map<string, TreeNode>();

  nodes.forEach(n => byId.set(n.id, { ...n, children: [] }));

  byId.forEach(n => {
    const key = n.parentId ?? "__root__";
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  });

  // sort
  byParent.forEach(list => list.sort((a,b) => a.order - b.order));

  // attach children
  byId.forEach(n => {
    const key = n.id;
    n.children = byParent.get(key) ?? [];
  });

  return byParent.get("__root__") ?? [];
}
```

---

## 7. D&D並び替え設計（dnd-kit）
### 7.1 スコープ（v1推奨）
- **同一親（siblings）内の並び替え**を基本にする  
  - 理由：誤操作で親子関係が壊れやすい/実装が簡潔/データ整合性が安定
- 親の変更（別ノード配下に移動）は v1では  
  - 「移動先を選択」UI（ドロップダウン）などで実装、または v2

### 7.2 実装要点
- 親ごとに `SortableContext` を置く（children配列の順序が対象）
- `onDragEnd` で新しい `orderedChildIds` を作り `reorderSiblings` を呼ぶ
- `reorderSiblings` は siblingsの `order` を 0..n-1 で振り直し

---

## 8. ワークスペースのテキスト化（エクスポート＆LLMコンテキスト）
### 8.1 Markdown出力ルール（エクスポート用：IDなし）
- 先頭：
  - `# {テーマ}`
  - 追加説明があれば `> 追加説明: ...`
- ノード：
  - `heading`：`- {title}`
  - `note`：`- {text}`
  - `question`：
    - reconstructedTextあり → `- {reconstructedText}`
    - reconstructedTextなし & answerあり → `- {question}: {answer}`
    - answerなし → `- {question}`

- 階層はインデント（2スペース）で表現

### 8.2 LLMコンテキスト用（IDあり・推奨）
LLMが `parentId` を正しく返せるよう、各行にIDを埋め込み。

例：
```md
# テーマ

- [n_h1] 目的/ゴール
  - [n_q1] 目的：◯◯
- [n_h2] 現状/背景
  - [n_q2] 現状の課題：締切まで1週間と短く、作業可能日も半分と限られる
```

実装は `workspaceToMarkdown({ includeIds: boolean, forLLM: boolean })` のように分ける。

**forLLM時の推奨オプション**
- answerは長くなりがちなので、1ノードあたり最大文字数を制限（例：200字）  
  ※仕様に明記しておくと後でトークン溢れを起こしにくい（“最適化”ポイント）

---

## 9. LLM設計（入出力・プロンプト・スキーマ）
> HTTP呼び出し詳細（fetch/headers等）は別ファイル。ここでは**機能単位のIF**を定義。

### 9.1 LLM機能一覧
1) **初期生成（ワークスペース作成時）**  
- 出力：指針（5–10）＋初期ツリー（heading/question中心）

2) **再構成（questionノード）**  
- 入力：question + answer  
- 出力：reconstructedText（簡潔な1行）

3) **追加質問生成（自動挿入）**  
- 入力：テーマ/追加説明/指針/現在のワークスペース文脈（ID付き）/生成数  
- 出力：newQuestions[{ question, parentId|null }]

### 9.2 JSONスキーマ（構造化出力）
#### (A) 初期生成
```ts
type InitialGenerateOutput = {
  guidelines: string[]; // 5-10
  tree: Array<{
    type: "heading" | "question" | "note";
    title?: string;
    question?: string;
    text?: string;
    children?: any[];
  }>;
};
```

#### (B) 再構成
```ts
type ReconstructOutput = {
  reconstructedText: string;
};
```

#### (C) 追加質問
```ts
type FollowupGenerateOutput = {
  newQuestions: Array<{
    question: string;
    parentId: string | null; // 既存nodeId or null
  }>;
};
```

### 9.3 プロンプト方針（共通）
- 1質問1論点
- Yes/Noで終わらない聞き方
- 前提/制約/具体例/評価軸/代替案/リスク/次アクションを意識
- 既に書かれている内容の繰り返しは避ける（厳密判定はしないので、プロンプトで強めに指示）
- **出力はJSONのみ**（コードフェンス禁止）

### 9.4 プロンプト例（設計書テンプレ）
#### (1) 初期生成
**system**
- 「あなたは議論を網羅するための設計者。ユーザーが答えやすい具体的な問いを作る…」

**user（例）**
```text
テーマ: """{theme}"""
追加説明: """{description || ""}"""

要件:
- このテーマを検討/言語化するための「議論の大枠（観点）」を5〜10個、短い日本語の箇条書きで作る
- その観点に基づき、初期ツリーを作る（headingを基本にし、各headingに1〜3個のquestionをぶら下げる）
- 質問は具体的で答えやすく、Yes/Noで終わらない
- 出力は必ずJSONのみ（コードフェンスや説明文は禁止）

出力形式:
{
  "guidelines": ["...", "..."],
  "tree": [
    { "type":"heading", "title":"...", "children":[
      { "type":"question", "question":"..." }
    ]}
  ]
}
```

#### (2) 再構成
```text
質問: """{question}"""
回答: """{answer}"""

指示:
- 回答内容を簡潔に表現する1文を作る
- 形式は「{要点名}: {内容}」のように自然な日本語で
- 出力はJSONのみ

出力形式:
{ "reconstructedText": "..." }
```

#### (3) 追加質問生成（自動挿入）
```text
テーマ: """{theme}"""
追加説明: """{description || ""}"""
質問生成指針: """{guidelineText}"""

現在のワークスペース（ID付き）:
{workspaceMarkdownWithIds}

要件:
- 新しい質問を{N}個生成
- 既存の質問/内容の言い換えを避ける
- 1質問1論点、Yes/Noで終わらない
- parentIdは上記の [xxxx] に出てくるIDから選ぶ（見つからなければ null）
- 出力はJSONのみ

出力形式:
{
  "newQuestions": [
    { "question": "...", "parentId": "..." }
  ]
}
```

### 9.5 LLM結果の取り込みルール
- JSON parseに失敗 → エラー表示し、状態は変更しない（再構成済み等も反映しない）
- `parentId` が存在しない/不正/別workspaceのID → `null`（ルート）へフォールバック
- 追加質問は **自動挿入**
  - siblingsの最後に挿入（order = max+1）

---

## 10. 主要ユースケースの処理フロー
### 10.1 ワークスペース作成
1. theme/description入力
2. `createWorkspaceWithLLM` 呼び出し
3. LLM(初期生成) → `guidelines + tree`
4. `guidelineText` に guidelines を整形して格納（例：`- ...\n- ...`）
5. treeをflattenしてノード作成（id発行、parentId設定、order付与）
6. 保存 → メイン画面遷移

### 10.2 再構成（questionノード）
1. answerが空ならボタン非活性（推奨）
2. 再構成LLM実行
3. `reconstructedText` を上書き
4. 続けて追加質問LLM実行（N=workspace.config.followupCount）
5. newQuestions を自動挿入

### 10.3 手動追加
- 「子を追加」→ type選択→空ノード生成→即編集（フォーカス）
- orderは兄弟の末尾

### 10.4 削除
- ノード削除：子孫を全探索して削除（BFS/DFS）
- ワークスペース削除：workspaceと紐づくnodeを全削除

---

## 11. 永続化（localStorage / Zustand persist）
- persist key例：`gironomall:v1`
- versionを持たせる（`version: 1`）  
  将来スキーマ変更に備えて `migrate` を用意できる形にしておく

**注意**
- localStorage容量上限があるため、回答が長大になると破綻しうる  
  → v1は許容、設計書には「長文はエクスポート推奨」と注記（最適化ポイント）

---

## 12. エラー処理・制御
- APIキー未設定：生成系ボタンを無効化し、アプリ設定への導線を出す
- 401/429/5xx：トースト表示（nodeの編集内容は保持）
- 多重クリック防止：nodeBusy / rootBusyでボタンdisabled

---

## 13. ディレクトリ構成（推奨）
```txt
src/
  app/
    App.tsx
    router.tsx
  stores/
    persistStore.ts
    uiStore.ts
  features/
    workspaces/
      pages/
        WorkspaceListPage.tsx
        WorkspacePage.tsx
        WorkspaceSettingsPage.tsx
      components/
        TreeView.tsx
        NodeRow/
          QuestionRow.tsx
          HeadingRow.tsx
          NoteRow.tsx
        ExportArea.tsx
      domain/
        tree.ts           // buildTree, flatten, cascade delete 等
        markdown.ts       // export/context markdown
        ordering.ts       // reorder helpers
  lib/
    llm/
      prompts.ts         // プロンプト生成（本設計書のテンプレを実装）
      schemas.ts         // zod等でスキーマ定義（推奨）
      client.ts          // ★別ファイル：OpenRouter呼び出し詳細
  styles/
    index.css
```

---

## 14. 追加の実装メモ（“最適化”のための小さな推奨）
- LLMコンテキスト用Markdownは「回答の最大文字数を制限」してトークン溢れを予防
- 追加質問自動挿入は便利だが増殖しやすいので、UI上で  
  - 直近追加分をハイライト  
  - 「折りたたみ」  
  があると運用しやすい
