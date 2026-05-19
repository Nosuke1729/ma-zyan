# ma-zyan

オンライン対戦できる日本麻雀プロトタイプです。

## 現在できること

- 四麻 / 三麻の部屋作成
- 部屋IDで参加
- 人数がそろったら対局開始
- サーバー側で山生成、シャッフル、配牌、ツモ、打牌
- 自分の手牌だけ表示し、他家の手牌は枚数だけ表示
- 捨て牌、点数、ドラ表示牌、山の残り枚数を共有
- 和了判定と役判定を拡張するための土台

まだ雀魂レベルの完全実装ではありません。今後、鳴き、リーチ、ロン、ツモ、フリテン、符計算、点数移動、半荘進行を追加して完成度を上げる構成です。

## 構成

```txt
frontend/  GitHub Pages に置くWeb画面
server/    Renderで動かすWebSocketサーバー
```

## ローカル起動

```bash
npm run install:all
npm run dev:server
```

別ターミナルで：

```bash
npm run dev:frontend
```

ローカルではフロントエンドが `ws://localhost:8787` に接続します。

## Renderでサーバーをデプロイ

RenderでこのGitHubリポジトリを接続し、BlueprintまたはWeb Serviceとしてデプロイします。

`render.yaml` を追加済みなので、Blueprintとして作る場合は以下の設定になります。

```txt
rootDir: server
buildCommand: npm install && npm run build
startCommand: npm start
```

Renderで公開されたURLが例えば：

```txt
https://ma-zyan-server.onrender.com
```

なら、WebSocket URLは：

```txt
wss://ma-zyan-server.onrender.com
```

になります。

## GitHub PagesでWebをデプロイ

`frontend/index.html` と Vite の設定は作成済みです。

GitHub Pagesは `frontend/dist` をデプロイするGitHub Actionsを使います。

GitHub側で以下を設定してください。

1. Repository Settings → Pages
2. Source を `GitHub Actions` にする
3. Repository Settings → Secrets and variables → Actions
4. `VITE_WS_URL` を追加
5. 値を Render の WebSocket URL にする

例：

```txt
VITE_WS_URL=wss://ma-zyan-server.onrender.com
```

その後、`main` にpushされると自動でGitHub Pagesにデプロイされます。

## WebページURL

GitHub Pagesを有効化すると、基本的には以下になります。

```txt
https://nosuke1729.github.io/ma-zyan/
```

## 注意

Renderの無料プランでは、しばらくアクセスがないとサーバーがスリープすることがあります。その場合、最初の接続だけ時間がかかります。
