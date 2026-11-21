"""Test the remote helper against disposable files and SQLite databases."""
import hashlib
import io
import json
from pathlib import Path
import runpy
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


class RemoteDeploymentTests(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.home = Path(scratch.name)
        self.backups = self.home / "backups"
        self.database = self.home / "production.sqlite"
        self.release = self.home / "release"
        self.release.mkdir()
        script = Path(__file__).resolve().parents[1] / "scripts" / "deploy-remote.py"
        self.remote = runpy.run_path(str(script))
        self.remote["backup"].__globals__.update(BACKUPS=self.backups, DATABASE=self.database)
        self.writer = sqlite3.connect(self.database)
        self.addCleanup(self.writer.close)
        self.writer.execute("PRAGMA journal_mode=WAL")
        self.writer.execute("PRAGMA wal_autocheckpoint=0")
        self.writer.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        self.writer.execute("INSERT INTO users VALUES (42)")
        self.writer.commit()

    def backup(self):
        with patch("sys.stdout", new_callable=io.StringIO) as output:
            self.remote["backup"]()
        return Path(output.getvalue().strip())

    def test_backup_includes_wal_and_publishes_only_verified_snapshots(self):
        self.assertGreater(self.database.with_name("production.sqlite-wal").stat().st_size, 0)
        saved = self.backup()
        with sqlite3.connect(saved.as_uri() + "?mode=ro", uri=True) as copy:
            self.assertEqual(copy.execute("SELECT id FROM users").fetchall(), [(42,)])
            self.assertEqual(copy.execute("PRAGMA journal_mode").fetchone(), ("delete",))
        with patch.dict(self.remote["backup"].__globals__, check_database=lambda db: self.fail("bad backup")):
            with self.assertRaises(AssertionError):
                self.backup()
        self.assertEqual(list(self.backups.iterdir()), [saved])

    def test_failed_migration_leaves_source_intact_and_retries_with_a_fresh_copy(self):
        saved = self.backup()
        abandoned = self.backups / ".migration-abandoned"
        abandoned.mkdir()
        (abandoned / "migration.sqlite").write_bytes(b"interrupted run")
        original = saved.read_bytes()
        self.release.joinpath("server").mkdir()
        db_js = """
            exports.openDatabase = file => {
              const db = new (require('node:sqlite').DatabaseSync)(file);
              db.exec("PRAGMA user_version=5; INSERT INTO users VALUES (99)");
              return db;
            };
        """
        db_module = self.release / "server" / "db.js"
        db_module.write_text("process.exit(1);", encoding="utf-8")
        with self.assertRaises(subprocess.CalledProcessError):
            self.remote["migration"](self.release, saved.name)
        self.assertFalse((self.release / ".random-release").exists())
        db_module.write_text(db_js, encoding="utf-8")
        self.remote["migration"](self.release, saved.name)
        self.assertEqual((self.release / ".random-release").read_text().strip(), self.release.name)
        self.assertEqual(saved.read_bytes(), original)
        self.assertEqual(self.writer.execute("SELECT id FROM users").fetchall(), [(42,)])
        self.assertEqual(set(self.backups.iterdir()), {saved, abandoned})

    def test_manifest_checks_raw_bytes_and_rejects_missing_or_extra_files(self):
        data = bytes([0, 255, 13, 10, 26])
        name = "écran test.bin"
        file = self.release / name
        file.write_bytes(data)
        manifest = [(name, hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest())]

        def verify():
            with patch.object(sys, "stdin", io.StringIO(json.dumps(manifest))):
                self.remote["verify"](self.release)

        verify()
        extra = self.release / "extra"
        extra.touch()
        with self.assertRaisesRegex(RuntimeError, "file mismatch"):
            verify()
        extra.unlink()
        file.unlink()
        with self.assertRaisesRegex(RuntimeError, "missing tracked files"):
            verify()


if __name__ == "__main__":
    unittest.main()
