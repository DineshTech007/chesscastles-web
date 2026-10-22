#!/bin/bash
# Builds new study openings end to end (the steps of scripts/study, for the openings given):
#   bash scripts/study/build_new.sh ruy-lopez,italian,...
# Work files in $W; the site's files in static/data/study and src/lib/study/chapters.json.
set -e
export PYTHONPATH=C:/dev/tools/py
W=/f/dev/gamesdb_work/study2
LIST="$1"
cd /f/dev/knight24-web
mkdir -p $W/puzzles $W/middlegame
echo "== scan $(date)"
python scripts/study/scan.py F:/dev/caissabase_2024.db3 $W --only "$LIST" --min-elo 2000 > $W/scan-new.log 2>&1
tail -1 $W/scan-new.log
for o in ${LIST//,/ }; do
  echo "== $o: book and chapters $(date)"
  rm -rf static/data/study/book/$o
  python scripts/study/repertoire.py $W static/data/study src/lib/study/chapters.json $o > $W/repertoire-$o.log 2>&1
  head -1 $W/repertoire-$o.log
  python scripts/study/segments.py $W $o
  python scripts/study/segments2.py $W src/lib/study/chapters.json $o
  python scripts/study/middlegame.py $W src/lib/study/chapters.json $o
done
echo "== strategy $(date)"
python scripts/study/strategy.py $W src/lib/study/chapters.json
for o in ${LIST//,/ }; do
  echo "== $o: engine $(date)"
  for s in 0 1 2 3; do node scripts/study/puzzles.mjs scan $W/segments-$o.json $W/puzzles/$o-strong$s.json $s 4 > $W/$o-strong$s.log 2>&1 & done; wait
  for s in 0 1 2 3; do node scripts/study/puzzles.mjs scan $W/segments2-$o.json $W/puzzles/$o-club$s.json $s 4 > $W/$o-club$s.log 2>&1 & done; wait
  for s in 0 1 2 3; do node scripts/study/middlegame.mjs check $W/middlegame-$o.json $W/middlegame/$o-$s.json $s 4 > $W/$o-mg$s.log 2>&1 & done; wait
  tail -qn1 $W/$o-strong?.log $W/$o-club?.log | tr '\n' ' '; echo
done
echo "== lichess $(date)"
python scripts/study/lichess_puzzles.py F:/dev/gamesdb_work/puzzles/lichess_db_puzzle.csv.zst $W/lichess.json src/lib/study/chapters.json > $W/lichess.log 2>&1
node scripts/study/middlegame.mjs build $W static/data/study
node scripts/study/puzzles.mjs build $W static/data/study | cut -c1-140
echo "== done $(date)"
