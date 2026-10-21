"""Scrub a private Playwright trace before it becomes a CI artifact."""
import json
import re
import sys
import zipfile
from pathlib import Path

source, target = map(Path, sys.argv[1:])
secrets = sorted(set(json.load(sys.stdin)), key=len, reverse=True)
secret_bytes = [value.encode() for value in secrets if value]
private_keys = {"authorization", "cookie", "set-cookie", "x-siab-origin-verify",
                "password", "currentpassword", "newpassword", "token", "apikey", "secret", "salt", "hash"}


def scrub(value):
    if isinstance(value, list):
        return [scrub(item) for item in value]
    if isinstance(value, dict):
        if str(value.get("name", "")).lower() in private_keys and "value" in value:
            value = {**value, "value": "[REDACTED]"}
        return {key: ([] if key.lower() == "cookies" else "[REDACTED]"
                      if key.lower() in private_keys or key.lower() == "postdata" else scrub(item))
                for key, item in value.items()}
    return value


size = 0
with zipfile.ZipFile(source) as original, target.open("xb") as output:
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as clean:
        for info in original.infolist():
            if info.filename.startswith("/") or ".." in Path(info.filename).parts:
                raise ValueError("Unsafe trace member")
            size += info.file_size
            if size > 256 * 1024 * 1024:
                raise ValueError("Trace exceeds its completeness bound")
            data = original.read(info)
            if info.filename.endswith((".trace", ".network", ".json")):
                lines = []
                for line in data.decode().splitlines():
                    try:
                        lines.append(json.dumps(scrub(json.loads(line))))
                    except json.JSONDecodeError:
                        lines.append(line)
                data = ("\n".join(lines) + "\n").encode()
            for secret in secret_bytes:
                data = data.replace(secret, b"[REDACTED]")
            data = re.sub(rb"eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}", b"[REDACTED-JWT]", data)
            clean.writestr(info.filename, data)
