# 埼玉14区 目安箱（まこと目安箱）

自由民主党 衆議院議員 藤田まこと事務所（埼玉14区：草加市・八潮市・三郷市）が運営する、地域の困りごとの「見える化」サイトです。LINEで届いたお悩みを、NG以外は個人情報を伏せて原文に近い形で公開し、件数と解決事例で議員活動を示します。

**サイトURL**：https://fujitamakoto-4.github.io/meyasubako/

## 仕組み

```
LINE（相談を送る）
  → 事務所（受付台帳へ記録・NG判定・個人情報を伏せる）
  → このリポジトリ（公開データを管理）
  → GitHub Pages（このサイト）
```

相談の受付・やりとりはLINE上で完結します。事務所がNG（誹謗中傷・特定個人/団体への攻撃・クレーム的なもの・公序良俗違反・営業目的）にあたらないかを判定し、個人が特定される情報を伏せたうえで、このリポジトリの `docs/data/*.json` を更新します。更新は事務所の受付台帳（Google スプレッドシート）から Google Apps Script が日次で書き込みます。詳しい公開の考え方は [POLICY.md](./POLICY.md) を参照してください。

## データファイル

`docs/data/` 以下の3ファイルは、台帳から自動更新される**データ契約**です（このスキーマは変更しないでください）。

### `voices.json` — みんなのお悩み

```json
{
  "generatedAt": "2026-08-18T06:00:00+09:00",
  "sample": true,
  "items": [
    {
      "id": "R-2026-0001",
      "category": "生活環境（騒音・獣害等）",
      "theme": "野生動物・獣害",
      "city": "三郷市",
      "month": "2026-07",
      "text": "（マスク済み原文）",
      "caseId": "C-2026-001"
    }
  ]
}
```

- `category` は8分類（医療・介護・年金／がん・治療と仕事／防災・道路・インフラ／子育て・教育／地域経済・中小企業／交通・まちづくり／生活環境（騒音・獣害等）／その他）のいずれか。
- `theme` が空文字の場合、サイト側では「その他のテーマ」として束ねて表示します。
- `city` は 八潮市／草加市／三郷市／その他 のいずれか。
- `caseId` は対応する解決事例があるときのみセットし、なければ `null`。
- 並び順＝月の新しい順（同月内は `id` 降順）。

### `stats.json` — 数字で見る

```json
{
  "generatedAt": "...",
  "sample": true,
  "total": 24,
  "published": 20,
  "thisMonth": 3,
  "byCategory": { "医療・介護・年金": 3 },
  "byCity": { "八潮市": 9 },
  "monthly": [ { "month": "2026-03", "count": 3 } ]
}
```

- `total` はNG（取消・対象外）を除く受付件数（公開を希望しなかった件数も含む）。
- `published` は本文を掲載している件数（＝ `voices.json` の件数）。
- `monthly` は直近6ヶ月以上・古い順。

### `cases.json` — 解決事例（自動生成・手編集不可）

`cases/*.md` から `scripts/build-cases.mjs` が生成します。直接編集しないでください。

frontmatterの `hero` / `heroAlt` / `heroCaption` / `video` / `videoId`（`video`のYouTube URLから自動抽出） / `videoCaption` が各itemに追加されています（未指定なら `null`）。また各 `steps[]` に、本文を段落・画像ブロックの列に分解した `blocks`（`{type:'p', text}` または `{type:'img', src, alt, caption}`）が追加されています。従来の `steps[].p`（画像を除いたテキストを結合した文字列）は後方互換のため引き続き出力されます。`voices.json` / `stats.json` のスキーマに変更はありません。

## 解決事例の追加方法

1. `cases/` 以下に `C-YYYY-NNN-slug.md` という名前でMarkdownファイルを作成する（書式は既存ファイルを参照）。
2. frontmatter に `id` / `slug` / `title` / `category` / `city` / `month` / `summary` / `receiptIds` / `sources` / `publishedAt` を書く。本文は `## 受付` `## 動き` `## 結果` `## 今後` のような見出し＋段落で構成する。
3. `publishedAt` が空、または未来日の場合は「下書き」として扱われ、`docs/data/cases.json` には出力されません（サイトにも表示されません）。公開する日が決まったら日付（`YYYY-MM-DD`）を入れてください。
4. `cases/` または `scripts/` を変更して push すると、GitHub Actions（`.github/workflows/build-cases.yml`）が `node scripts/build-cases.mjs` を実行し、`docs/data/cases.json` を自動更新してコミットします。
5. ローカルで確認したい場合は `npm run build:cases`（または `node scripts/build-cases.mjs`）を実行してください。依存パッケージのインストールは不要です。

担当者個人名・メールアドレス・電話番号は本文に書かないでください。

### 画像・動画を追加する（任意）

アイキャッチ画像・本文内画像・YouTube動画は、すべて任意項目です。書かなければ従来どおりテキストのみの事例として表示されます。

**アイキャッチ画像・動画（frontmatterに追加）**

```yaml
hero: media/cases/inoshishi-misato/hero.jpg
heroAlt: 江戸川河川敷に設置された「イノシシ出没注意」の看板
heroCaption: 三郷市田中新田地先に設置された注意看板（2026年7月・国土交通省 江戸川河川事務所提供）
video: https://www.youtube.com/watch?v=XXXXXXXXXXX
videoCaption: 現地の様子（2026年7月）
```

- `hero` / `heroAlt` / `heroCaption` はセットで使う（`hero` だけでも可。`heroAlt`が無いと空のalt属性になるので、画像に意味がある場合は書くこと）。タイトル・市/受付月の直下、ストーリーの上に表示されます。
- `video` はYouTubeのURL（`watch?v=`／`youtu.be/`／`shorts/` のいずれの形式でも可）。サイトにはYouTubeのサムネイル画像＋再生ボタン風の表示のみを埋め込み、クリックすると新しいタブでYouTubeが開きます（iframe埋め込みはしません＝閲覧者に余計なCookieを付けない・軽量）。`videoCaption` は任意。
- 動画ファイル自体はこのリポジトリに置かないでください（YouTubeにアップロードしてURLを書く）。誤って `.mp4` / `.mov` をコミットしないよう `.gitignore` で除外しています。
- 画像が用意できない事例では、`hero` 等の行を空値で書かず、frontmatter自体に追加しないでください（空値はYAML的な扱いが曖昧になるため）。

**本文内の画像（Markdown本文に挿入）**

`## 受付` などの各セクション内の好きな位置に、通常のMarkdown画像記法で1行として書く。

```markdown
![看板3か所の位置図](media/cases/inoshishi-misato/map.jpg "設置箇所の位置図（国土交通省 江戸川河川事務所提供）")
```

- `[ ]` 内が代替テキスト（alt）、`( )` 内が画像パス、末尾の `" "` は任意のキャプション（省略可）。
- 画像の前後にある文章はそのまま段落として表示され、画像はその位置に差し込まれます。

**画像ファイルの置き場所**

- `docs/media/cases/<slug>/` 以下に置く（例: `docs/media/cases/inoshishi-misato/hero.jpg`）。frontmatter・本文の画像パスは、いずれも `docs/` からの相対パス（例: `media/cases/<slug>/hero.jpg`）で書く。
- 1枚1MB以下・横1200px程度・JPG/WebP推奨。
- 存在しないパスを指定すると、`node scripts/build-cases.mjs` 実行時に警告ログが出ます（ビルド自体は止まりません）。プレビューでは画像が表示されないだけなので、パスを見直してください。

## 公開の考え方

NG基準・マスキング方針・件数のみを公開する理由などは [POLICY.md](./POLICY.md) にまとめています。

## 参考にした取り組み

チームみらい（安野たかひろ氏）の政策リポジトリ（https://github.com/team-mirai/policy ）における、GitHubを用いた情報公開・透明性の取り組みを参考にしています。本サイトは「陳情対応の見える化」に主眼を置く点で、政策共創を目的とするチームみらいの取り組みとは位置づけが異なります。

## ライセンス

**現時点では、本リポジトリのコード・文章・データの無断転載・再利用はご遠慮ください（All rights reserved・2026-08-18時点）。** 運用が安定した段階で、掲載しているお悩み・解決事例・件数などの**文章・データは CC BY 4.0（出典「埼玉14区 目安箱（藤田まこと事務所）」の明記で引用・転載可）**として公開する予定です（事務所決定済み・時期は未定）。コードの扱いは別途判断します。引用・転載をご希望の場合は、下記お問い合わせ先までご連絡ください。

## お問い合わせ

衆議院議員 藤田まこと事務所の公式サイト（https://fujitamakoto.com/ ）よりお問い合わせください。

---

運営：衆議院議員 藤田まこと事務所
