# おせっかい勇者 Prototype v81

- 雲登り開始時の `drawBackground is not defined` を修正
- v80で存在しない描画関数を呼んでいたため、勇者・モンク共通で停止していた問題を解消
- 雲登り専用描画を既存Canvas上で直接行うよう変更
- モード開始時に古いERROR表示も消去
- game.js?v=81
