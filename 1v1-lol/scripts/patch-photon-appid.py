#!/usr/bin/env python3
"""Replace the archived 1v1.lol Photon AppId in rc.data.unityweb.

Get a free PUN / Photon Realtime App Id from https://dashboard.photonengine.com/
(Create an app → copy the Realtime App ID — must be exactly 36 characters, UUID format.)

Usage:
  python scripts/patch-photon-appid.py YOUR-NEW-APP-ID-HERE
"""

import gzip
import sys
from pathlib import Path

OLD = b"82620531-8737-4824-8fd2-a4d29e2417d8"
DATA_FILE = Path(__file__).resolve().parent.parent / "rc.data.unityweb"


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    new = sys.argv[1].strip().encode("ascii")
    if len(new) != len(OLD):
        print(f"Error: App Id must be {len(OLD)} characters (UUID format). Got {len(new)}.")
        sys.exit(1)

    raw = DATA_FILE.read_bytes()
    data = gzip.decompress(raw)
    count = data.count(OLD)
    if count == 0:
        print("Old App Id not found — file may already be patched.")
        sys.exit(1)

    data = data.replace(OLD, new)
    DATA_FILE.write_bytes(gzip.compress(data, compresslevel=9))
    print(f"Patched {count} occurrence(s) in {DATA_FILE}")
    print("Redeploy and hard-refresh the site. PLAY uses Photon online servers.")


if __name__ == "__main__":
    main()
