"""Operations sent over SSH by deploy.js. Nothing is installed on the host."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import uuid
from contextlib import closing

HOME = Path("/home/ttrpg-random")
DATABASE = HOME / "random-data" / "random.sqlite"
BACKUPS = HOME / "random-backups"


def check_database(db):
    if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
        raise RuntimeError("SQLite integrity check failed")
    if db.execute("PRAGMA foreign_key_check").fetchone():
        raise RuntimeError("SQLite foreign key check failed")


def read_database():
    return closing(sqlite3.connect(DATABASE.as_uri() + "?mode=ro", uri=True))


def check(operation):
    with read_database() as db:
        db.execute("SELECT id FROM users LIMIT 1").fetchone()
        schema = db.execute("PRAGMA user_version").fetchone()[0]
    if BACKUPS.exists() and not os.access(BACKUPS, os.W_OK | os.X_OK):
        raise RuntimeError("Backup directory is not writable")
    if not BACKUPS.exists() and not os.access(HOME, os.W_OK | os.X_OK):
        raise RuntimeError("Cannot create the backup directory")
    if operation == "deploy":
        for name in ("tar", "flock"):
            if not shutil.which(name):
                raise RuntimeError(f"Missing required server command: {name}")
        if not os.access(HOME, os.W_OK | os.X_OK) or not os.access(DATABASE, os.W_OK):
            raise RuntimeError("Missing deployment or database write permissions")
        subprocess.run(["node", "-e", "require('node:sqlite')"], check=True,
                       env=dict(os.environ, NODEJS_VERSION="24"), stdout=subprocess.DEVNULL)
    print(f"SSH and SQLite available. Database schema: {schema}.")


def backup():
    BACKUPS.mkdir(mode=0o700, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    saved = BACKUPS / f"random-{stamp}-{uuid.uuid4().hex}.sqlite"
    with tempfile.TemporaryDirectory(prefix=".backup-", dir=BACKUPS) as scratch:
        partial = Path(scratch) / "snapshot.sqlite"
        with read_database() as source, closing(sqlite3.connect(partial)) as copy:
            source.backup(copy)
            copy.execute("PRAGMA journal_mode=DELETE")
            check_database(copy)
        partial.rename(saved)
    print(saved)


def verify(release):
    manifest = dict(json.load(sys.stdin))
    found = set()
    for entry in release.rglob("*"):
        if entry.is_symlink():
            raise RuntimeError("Unexpected symlink in release")
        if entry.is_dir():
            continue
        name = entry.relative_to(release).as_posix()
        data = entry.read_bytes()
        digest = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
        if manifest.get(name) != digest:
            raise RuntimeError(f"Release file mismatch: {name}")
        found.add(name)
    if found != manifest.keys():
        raise RuntimeError("Release is missing tracked files")
    print(f"Verified {len(found)} release files.")


def migration(release, saved):
    if not re.fullmatch(r"random-[a-f0-9TZ-]+\.sqlite", saved):
        raise ValueError("Invalid backup name")
    # Unique scratch directories allow retries after interruption. Only this copy is migrated.
    with tempfile.TemporaryDirectory(prefix=".migration-", dir=BACKUPS) as scratch:
        copy = Path(scratch) / "migration.sqlite"
        shutil.copyfile(BACKUPS / saved, copy)
        subprocess.run(["node", "-e", """
            const db = require('./server/db').openDatabase(process.argv[1]);
            db.close();
        """, str(copy)], cwd=release, env=dict(os.environ, NODEJS_VERSION="24"), check=True)
        with closing(sqlite3.connect(copy.as_uri() + "?mode=ro", uri=True)) as db:
            check_database(db)
    (release / ".random-release").write_text(release.name + "\n", encoding="ascii")
    print("Migration verified on backup copy.")


if __name__ == "__main__":
    os.umask(0o077)
    operation, *args = sys.argv[1:]
    if operation == "check":
        check(*args)
    elif operation == "backup":
        backup()
    else:
        name, *args = args
        if not re.fullmatch(r"random-release-[0-9a-f]{40}-[0-9a-f]{32}", name):
            raise ValueError("Invalid release name")
        if operation == "verify":
            verify(HOME / name)
        elif operation == "migration":
            migration(HOME / name, *args)
        else:
            raise ValueError("Unknown deployment operation")
