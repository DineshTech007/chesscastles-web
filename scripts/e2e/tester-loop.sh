#!/usr/bin/env bash
# Runs the tester (scripts/e2e/tester.mjs) session after session until Aarav's CC Rating
# reaches the target (2500 by default), with a short rest between sessions.
#   NIGHT24_TEST_TOKEN=… scripts/e2e/tester-loop.sh [target] [max sessions]
cd "$(dirname "$0")/../.."
TARGET=${1:-2500}
MAX=${2:-60}
crashes=0
for i in $(seq 1 "$MAX"); do
  log="tester-data/run-$(date +%Y%m%d-%H%M).log"
  node scripts/e2e/tester.mjs --games 5 > "$log" 2>&1
  f=$(ls tester-data/session-*.json 2>/dev/null | sort | tail -1)
  rating=$(node -e "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(d.after?.menu?.rating??0)" "$f" 2>/dev/null || echo 0)
  bugs=$(grep -c "BUG \[" "$log")
  if grep -q "BUG \[Critical\] The session stopped" "$log"; then crashes=$((crashes+1)); else crashes=0; fi
  echo "$(date +%H:%M) session $i done: CC Rating $rating, $bugs bug lines, log $log"
  if [ "$rating" -ge "$TARGET" ] 2>/dev/null; then echo "TARGET REACHED: $rating"; break; fi
  if [ "$crashes" -ge 3 ]; then echo "STOPPED: three sessions in a row ended with an error"; break; fi
  sleep 60
done
