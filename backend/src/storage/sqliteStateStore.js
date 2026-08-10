const fs = require('fs');
const path = require('path');

/**
 * Persists the complete application state as one JSON document.  Keeping the
 * state in a single row lets the existing in-memory storage API stay exactly
 * the same while SQLite makes every completed write atomic.
 *
 * The JSON file is deliberately kept as a fallback: it is used on machines
 * where the native better-sqlite3 module cannot be loaded, and it is imported
 * once when upgrading an existing installation.
 */
class SQLiteStateStore {
  constructor({ databasePath, legacyDataFile, logger = console }) {
    this.databasePath = databasePath;
    this.legacyDataFile = legacyDataFile;
    this.logger = logger;
    this.db = null;
    this.usingSQLite = false;
    this.selectState = null;
    this.writeState = null;

    this.initialize();
  }

  initialize() {
    try {
      // better-sqlite3 v13 requires Node 22+. Electron 28 embeds Node 18, and
      // loading its native addon there can terminate the child process before
      // JavaScript gets a chance to catch the ABI error. Use the already
      // implemented atomic JSON fallback in that runtime instead.
      const nodeMajor = Number(String(process.versions.node || '0').split('.')[0]);
      if (process.versions.electron && nodeMajor < 22) {
        this.disableSQLite(new Error('Paketli Electron çalışma zamanı SQLite eklentisi için desteklenen Node sürümünü içermiyor.'), false);
        this.logger.warn('Paketli Electron sürümünde uyumlu SQLite eklentisi bulunamadı; atomik JSON veri dosyası kullanılacak.');
        return;
      }

      // Require inside initialize so a missing/incompatible native binary does
      // not prevent the backend from starting with the JSON fallback.
      // eslint-disable-next-line global-require
      const Database = require('better-sqlite3');
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });

      this.db = new Database(this.databasePath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = FULL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          state_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      this.selectState = this.db.prepare('SELECT state_json FROM app_state WHERE id = 1');
      const upsert = this.db.prepare(`
        INSERT INTO app_state (id, state_json, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `);
      this.writeState = this.db.transaction((stateJson, updatedAt) => {
        upsert.run(stateJson, updatedAt);
      });
      this.usingSQLite = true;
    } catch (error) {
      this.disableSQLite(error);
    }
  }

  disableSQLite(error, announce = true) {
    if (this.db) {
      try {
        this.db.close();
      } catch (_) {
        // Closing a failed database is only best effort.
      }
    }

    this.db = null;
    this.selectState = null;
    this.writeState = null;
    this.usingSQLite = false;

    if (announce) {
      this.logger.warn(`SQLite kullanılamıyor; JSON veri dosyası kullanılacak: ${error.message}`);
    }
  }

  readLegacySnapshot() {
    try {
      if (!this.legacyDataFile || !fs.existsSync(this.legacyDataFile)) return null;
      const rawData = fs.readFileSync(this.legacyDataFile, 'utf8');
      const data = JSON.parse(rawData);
      return data && typeof data === 'object' ? data : null;
    } catch (error) {
      this.logger.warn(`JSON veri dosyası okunamadı: ${error.message}`);
      return null;
    }
  }

  load() {
    if (!this.usingSQLite) return this.readLegacySnapshot();

    try {
      const row = this.selectState.get();
      if (row) {
        const state = JSON.parse(row.state_json);
        return state && typeof state === 'object' ? state : null;
      }

      // First SQLite launch: import the old JSON state once, without removing
      // it. The file remains a safe fallback for unsupported environments.
      const legacyState = this.readLegacySnapshot();
      if (legacyState) this.save(legacyState);
      return legacyState;
    } catch (error) {
      this.disableSQLite(error);
      return this.readLegacySnapshot();
    }
  }

  save(snapshot) {
    let serialized;
    try {
      serialized = JSON.stringify(snapshot);
    } catch (error) {
      this.logger.error(`Uygulama verisi JSON'a dönüştürülemedi: ${error.message}`);
      return false;
    }

    if (this.usingSQLite) {
      try {
        // The transaction writes the entire snapshot in one SQLite commit.
        this.writeState(serialized, Date.now());
        return true;
      } catch (error) {
        this.disableSQLite(error);
      }
    }

    return this.writeLegacySnapshot(serialized);
  }

  writeLegacySnapshot(serialized) {
    if (!this.legacyDataFile) return false;

    const temporaryFile = `${this.legacyDataFile}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.legacyDataFile), { recursive: true });
      fs.writeFileSync(temporaryFile, serialized);
      fs.renameSync(temporaryFile, this.legacyDataFile);
      return true;
    } catch (error) {
      try {
        if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
      } catch (_) {
        // Preserve the original error; temporary cleanup is best effort.
      }
      this.logger.error(`Veriler JSON dosyasına kaydedilemedi: ${error.message}`);
      return false;
    }
  }

  close() {
    if (!this.db) return;
    try {
      this.db.close();
    } finally {
      this.db = null;
      this.selectState = null;
      this.writeState = null;
      this.usingSQLite = false;
    }
  }
}

module.exports = { SQLiteStateStore };
