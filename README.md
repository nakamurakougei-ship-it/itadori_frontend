# イタドリ

定尺板から効率よく木取りを行う Web アプリです。

## 構成

| フォルダ / ファイル | 用途 |
|-------------------|------|
| `web/` | **Vercel 版**（Next.js）— デプロイ対象 |
| `itadori.py` | Streamlit 版（ローカル確認用・削除予定） |
| `streamlit_common/` | Streamlit 共通ユーティリティ |
| `requirements.txt` | Streamlit 版の依存関係 |
| `font/` | Streamlit 版の日本語フォント |
| `*.csv` | マスターデータ |

## Vercel 版（web/）

### ローカル開発

```bash
cd web
npm install
npm run dev
```

http://localhost:3000 で開けます。

### Vercel へのデプロイ

1. リポジトリを GitHub にプッシュ
2. [Vercel](https://vercel.com) で「Import Project」→ リポジトリを選択
3. **Root Directory** を `web` に設定
4. Framework Preset は **Next.js**（自動検出）
5. Deploy

### 静的アセット（任意）

| ファイル | 配置先 | 用途 |
|---------|--------|------|
| `itadori.jpg` | `web/public/itadori.jpg` | 背景画像 |
| `ipaexg.ttf` | `web/public/fonts/ipaexg.ttf` | 木取図の日本語フォント |

背景画像・フォントが無くてもアプリは動作します。

## Streamlit 版（ローカル用）

Vercel 版の動作確認後に削除を検討します。

```bash
pip install -r requirements.txt
streamlit run itadori.py
```
