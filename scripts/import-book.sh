#!/usr/bin/env bash
# Vivliostyle 本のリポジトリから動画素材を取り込む
#   scripts/import-book.sh <book_dir> [dpi]
# 出力:
#   public/content/book/cover.png, back.png   表紙・裏表紙（あれば）
#   public/content/book/pages/p-001.png ...  screen.pdf の全ページ
#   book-outline.md                           原稿の見出し一覧（ファイル名付き）
set -euo pipefail
BOOK="${1:?usage: import-book.sh <book_dir> [dpi]}"
DPI="${2:-110}"
OUT=public/content/book
mkdir -p "$OUT/pages"

for f in hyoushi.png hyoushi.jpg; do [ -f "$BOOK/$f" ] && magick "$BOOK/$f" "$OUT/cover.png" && break; done
for f in urabyoushi.png urabyoushi.jpg; do [ -f "$BOOK/$f" ] && magick "$BOOK/$f" "$OUT/back.png" && break; done

PDF=""
for f in screen_covered.pdf screen.pdf print.pdf; do [ -f "$BOOK/$f" ] && PDF="$BOOK/$f" && break; done
if [ -n "$PDF" ]; then
  rm -f "$OUT"/pages/p-*.png
  pdftoppm -png -r "$DPI" "$PDF" "$OUT/pages/p"
  # pdftoppm はページ数で桁数が変わる（p-01 / p-001）ので、常に3桁に揃える
  for f in "$OUT"/pages/p-*.png; do
    n=$(basename "$f" .png); n=${n#p-}; n=$((10#$n))
    t=$(printf "%s/pages/p-%03d.png" "$OUT" "$n")
    [ "$f" = "$t" ] || mv "$f" "$t"
  done
  echo "pages: $(ls "$OUT/pages" | wc -l | tr -d ' ') from $PDF"
else
  echo "PDF が見つからない（先に本側で npm run build してね）" >&2
fi

{
  echo "# Book outline: $BOOK"
  echo
  SRC="$BOOK/src"; [ -d "$SRC" ] || SRC="$BOOK"
  for md in $(ls "$SRC"/*.md 2>/dev/null | sort); do
    echo "## $(basename "$md")"
    grep -E '^#{1,3} ' "$md" | sed 's/^/  /' || true
    echo
  done
} > book-outline.md
echo "outline: book-outline.md"
