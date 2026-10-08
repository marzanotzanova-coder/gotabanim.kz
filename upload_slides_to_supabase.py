#!/usr/bin/env python3
"""Upload slide preview images to Supabase private bucket 'slide-previews'."""
import os, glob, mimetypes
import urllib.request, urllib.error

SUPABASE_URL = "https://eknjslyvcwtusbqvygxx.supabase.co"
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET       = "slide-previews"
MATERIALS    = os.path.expanduser("~/Desktop/gotabanim-site/public/materials")

if not SERVICE_KEY:
    print("❌  SUPABASE_SERVICE_KEY env variable жоқ.")
    print("    Терминалда мынаны жазыңыз:")
    print("    export SUPABASE_SERVICE_KEY=\"your_service_role_key_here\"")
    exit(1)

# Only slide JPEG images (not thumbs, not qmj-thumbs)
pattern = os.path.join(MATERIALS, "lesson-*-slide*.jpeg")
files   = sorted(glob.glob(pattern))

print(f"Жүктелетін файлдар: {len(files)}")
if not files:
    print("❌  Файл табылмады:", pattern)
    exit(1)

ok = fail = 0
for fpath in files:
    fname = os.path.basename(fpath)
    url   = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{fname}"

    with open(fpath, "rb") as f:
        data = f.read()

    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "image/jpeg",
            "x-upsert": "true",          # overwrite if exists
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  ✓  {fname}  ({len(data)//1024} KB)")
            ok += 1
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ✗  {fname}  [{e.code}] {body[:120]}")
        fail += 1

print(f"\n✅  Дайын: {ok} жүктелді, {fail} қате")
