# Prototype v127

ヒーラーが横には動くのに縦へ降りなかった本当の原因を修正。

過去CSSに `top:auto!important` が残っており、
JavaScriptが毎フレーム計算していた `style.top` よりCSSの !important が勝っていた。
そのため重力の hy は内部では増えていても、画面上のヒーラーの縦位置だけ一切更新されていなかった。

v127:
- left / top の両方を JS から !important 付きで更新
- 古い top:auto!important の影響を遮断
- 頭が上端にはみ出して引っ掛かる衝突判定ではなかった
- 現在の弱重力・上下操作は維持
