# おせっかい勇者 Prototype v96

- v95で宝石モードを選んでも宝石が降らない初期化不具合を修正
- columns.js を body 最終部から確実に読み込む構成へ変更
- 宝石モード選択時、スクリプト読込タイミングに関係なく startColumns() を実行
- すでに宝石画面が開いている状態で columns.js が読み込まれた場合も自動開始
- game.js?v=96 / columns.js?v=96
