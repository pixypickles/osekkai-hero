# おせっかい勇者 Prototype v65

- 魔法使い通常開始問題のため、activeJob方式を撤去して職業管理をplayerClass一本に戻した
- 通常開始は startNormalStage を経由せず、選択職業・盤面・主人公位置を1つの同期処理で直接初期化
- 「この職業で開始」は pendingClass を使わず、画面上で実際に選択状態になっているボタンの data-class を直接読む
- 魔法使いなら playerClass=mage のまま、浮遊ON・空中位置へ配置
- 初期スライム配置は全職共通の seedOpeningBoard を1回だけ実行
- game.js?v=65 でキャッシュ更新
