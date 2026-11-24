#!/usr/bin/env bash
# Runs one of this folder's Play-mode tests with portkit/tools/playtest.sh, after putting "?v=<start of sha1>" on the
# page's script addresses (/web/...): the Play-mode browser keeps a script it fetched by address, and KitPlayTest
# versions only the bundle addresses (/kits/...). The local relay's saved room is removed first.   run.sh single|multi
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(dirname "$HERE")"
NAME="${1:?single or multi}"
OUT="$PROJECT/Library/PortKit/rp-$NAME.versioned.json"
python - "$HERE/$NAME.json" "$PROJECT/Assets/WebRoot" "$OUT" <<'PY'
import hashlib, json, re, sys
src, web, out = sys.argv[1:4]
doc = json.load(open(src, encoding="utf-8"))
def ver(m):
    path = m.group(1)
    digest = hashlib.sha1(open(web + "/" + path, "rb").read()).hexdigest()[:10]
    return "{SERVER}/web/" + path + "?v=" + digest
doc["elements"] = [re.sub(r"\{SERVER\}/web/([^\"?\s]+)", ver, e) for e in doc["elements"]]
json.dump(doc, open(out, "w", encoding="utf-8"), indent=2)
PY
# every run starts from an empty room: the local relay keeps space state (roles, recent lines) between Play sessions
ROOM="$PROJECT/Library/SideQuestLocalMultiplayer/space-state/room-s-untitled.json"
[ -f "$ROOM" ] && rm "$ROOM"
exec "$HERE/../../../portkit/tools/playtest.sh" "$PROJECT" "$OUT" rp-toolkit
