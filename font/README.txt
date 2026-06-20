木取図の日本語表示用フォント

GitHub にプッシュしてブラウザで開いている場合、アプリはクラウド（Streamlit Cloud 等）で
動いているため、お使いの PC の MS ゴシックは使えません。
このフォルダに日本語フォントを 1 つ置くと、木取図の「集成材」や部材名が正しく表示されます。

【手順】
1. IPAex フォント（IPA のサイト）をダウンロード
   https://moji.or.jp/ipafont/
   「IPAexゴシック」の zip をダウンロードし、解凍する

2. 解凍した中から「ipaexg.ttf」（IPAexゴシック）をこのフォルダ（font）にコピーする
   ※ 旧版では IPAexGothic.ttf の名前の場合もあります。どちらでも可です。

3. リポジトリにコミットして GitHub にプッシュする
   例: git add font/IPAexGothic.ttf
       git commit -m "木取図用日本語フォントを追加"
       git push

※ IPAex フォントは再配布可能です（IPA フォントライセンスに従ってください）。
