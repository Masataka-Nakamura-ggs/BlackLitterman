# ブラックリッターマンモデル Node.js/TypeScript 実装

## 概要

このプロジェクトは、フィッシャー・ブラックとロバート・リッターマンによって提唱されたブラックリッターマンモデルを、Node.js 環境で TypeScript を用いて実装したものです。
このモデルは、市場の均衡リターンと投資家の主観的なビュー（市場予測）を統合し、ポートフォリオの最適な資産配分を導き出すために利用されます。

この実装では、モデルのコアロジックである均衡リターンの計算、および投資家のビューを反映した事後期待リターンの計算に焦点を当てています。

## 特徴

* TypeScript による型安全な実装
* 行列演算ライブラリ `mathjs` を使用
* 最新の Node.js 環境 (ESモジュール) での動作を想定
* 投資家のビュー（絶対ビュー・相対ビュー）とその確信度を考慮可能

## 前提条件

* Node.js (v20.x 以降推奨、このプロジェクトは v22.x で開発・テストされました)
* npm (Node.js に同梱)

## インストール

1.  **リポジトリをクローンします (もしGitリポジトリにある場合):**
    ```bash
    git clone <リポジトリのURL>
    cd <リポジトリ名>
    ```

2.  **必要な依存パッケージをインストールします:**
    ```bash
    npm install
    ```
    これにより、`package.json` に記載されている `mathjs`, `ts-node`, `typescript` などのライブラリがインストールされます。
    （もし `package.json` が提供されていない場合は、個別にインストールしてください）
    ```bash
    npm install mathjs
    npm install --save-dev typescript ts-node @types/mathjs
    ```

## 設定

### `tsconfig.json`

このプロジェクトは、最新のNode.js (ESM) 環境で動作するように設定されています。`tsconfig.json` の主要な設定は以下の通りです。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
````

もし `tsconfig.json` がない場合は、以下のコマンドで生成し、上記のように設定してください。

```bash
npx tsc --init
```

### 入力データ (`blackLitterman.ts` 内)

モデルへの入力は `blackLitterman.ts` ファイル内の `exampleUsage` 関数で設定されています。以下の項目を実際のデータに合わせて変更してください。

  * `marketCovariance` (`S`): 資産リターンの共分散行列 (N x N)
  * `marketCapWeights` (`w_mkt`): 市場ポートフォリオの各資産のウェイト (N x 1)
  * `riskAversion` (`delta`): 市場のリスク回避係数
  * `P`: 投資家のビューのピッキング行列 (K x N)
  * `Q`: 投資家のビューに対応する期待リターン (K x 1)
  * `Omega`: ビューの誤差の共分散行列 (K x K)
  * `tau`: 事前分布（均衡リターン）の不確実性を示すスカラー

## 実行方法

以下のコマンドをプロジェクトのルートディレクトリで実行してください。

```bash
node --loader ts-node/esm blackLitterman.ts
```

または、以下のコマンドでも実行できる場合があります。

```bash
npx ts-node --esm blackLitterman.ts
```

実行すると、コンソールに以下の情報が出力されます。

  * 入力データ
  * 均衡期待リターン (Π)
  * 事後期待リターン (E[R])

## コード構成

  * **`blackLitterman.ts`**: モデルの主要なロジックと実行例が含まれています。
      * **型定義:**
          * `Vector`: 数値の1次元配列。
          * `Matrix`: 数値の2次元配列。
          * `BlackLittermanInputs`: モデルへの入力パラメータのインターフェース。
          * `BlackLittermanOutputs`: モデルからの出力のインターフェース。
      * **主要関数:**
          * `calculateEquilibriumReturns(...)`: 均衡期待リターン (Π) を計算します。
          * `calculateBlackLittermanPosteriorReturns(...)`: 投資家のビューを反映した事後期待リターン (E[R]) を計算します。
          * `runBlackLitterman(...)`: 上記の計算を実行し、結果を返します。
          * `exampleUsage()`: モデルの具体的な使用例と入力データの設定を行います。
      * **行列演算ヘルパー:** `mathjs` を利用した行列・ベクトル演算の基本的なラッパー関数。

## ライセンス

このプロジェクトは特定のライセンスを設定していません。自由にご利用ください。
(必要であれば、MIT License などを追記してください。)

## 注意点

  * この実装はブラックリッターマンモデルのコアな計算部分を提供するものであり、実際の投資判断に利用する際は、入力データの正確性やモデルの前提条件・限界について十分な理解が必要です。
  * 事後期待リターンを元にした実際のポートフォリオ最適化（ウェイト計算）は、このコードには含まれていません。別途、平均分散最適化などの手法を実装・利用する必要があります。

