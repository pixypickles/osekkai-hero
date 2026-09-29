# おせっかい勇者 Prototype v68

- 画像で確認できた `ReferenceError: dt is not defined` を修正
- 原因は魔王の剣タイマー処理が dt を受け取らない攻撃相殺関数へ誤って入っていたこと
- 魔王の剣タイマーを updateBoss(dt) へ移動
- 魔王戦でも通常CPUの spawnPair() が動いていたため、中央に色付きスライムが降っていた問題を修正
- 魔王戦では通常CPUペア生成を完全停止
- 魔王戦で生成される落下スライムは updateBoss の左右端無色スライムだけ
- game.js?v=68 でキャッシュ更新
