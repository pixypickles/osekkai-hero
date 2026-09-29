# おせっかい勇者 Prototype v64

- v63で通常・ボス戦ともキャラクターが消えた不具合を修正
- 原因: activeJob の宣言位置が描画ループ開始より後ろで、初回描画時に ReferenceError が発生
- activeJob をゲーム状態変数と同時に最初に初期化するよう移動
- v63の「選択職業をactiveJobで固定する」仕組み自体は維持
- game.js?v=64 でキャッシュ更新
