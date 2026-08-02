const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || '/data');
const DB_DIR = path.join(DATA_DIR, 'database');
const IMAGE_DIR = path.join(DATA_DIR, 'images');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const CONFIG_DIR = path.join(DATA_DIR, 'config');
const DB_PATH = path.join(DB_DIR, 'yatzy.sqlite');
const PAIR_KEY_PATH = path.join(CONFIG_DIR, 'pairing.key');
const MAX_BODY = Number(process.env.MAX_BODY_BYTES || 40 * 1024 * 1024);
const PAIR_TTL_MS = Math.max(60_000, Number(process.env.PAIR_TTL_SECONDS || 300) * 1000);
const VERSION = '2.3.4';

for (const dir of [DATA_DIR, DB_DIR, IMAGE_DIR, BACKUP_DIR, CONFIG_DIR]) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS datasets (
    code TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pairings (
    token_hash TEXT PRIMARY KEY,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    profile_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pairings_expires ON pairings(expires_at);
  CREATE INDEX IF NOT EXISTS idx_profiles_updated ON profiles(updated_at);
`);

function loadPairingKey() {
  if (fs.existsSync(PAIR_KEY_PATH)) {
    const raw = fs.readFileSync(PAIR_KEY_PATH, 'utf8').trim();
    const key = Buffer.from(raw, 'base64');
    if (key.length === 32) return key;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(PAIR_KEY_PATH, key.toString('base64'), { mode: 0o600 });
  try { fs.chmodSync(PAIR_KEY_PATH, 0o600); } catch {}
  return key;
}
const pairingKey = loadPairingKey();

const json = (res, status, body, extraHeaders = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, CF-Access-Client-Id, CF-Access-Client-Secret',
    ...extraHeaders
  });
  res.end(payload);
};

const html = (res, status, body, extraHeaders = {}) => {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(body);
};

const redirect = (res, location) => {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  res.end();
};

const safeCode = value => /^[A-Za-z0-9_-]{3,40}$/.test(value || '') ? value : null;
const safeToken = value => /^[A-Za-z0-9_-]{40,90}$/.test(value || '') ? value : null;
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const nowIso = () => new Date().toISOString();
const clone = value => JSON.parse(JSON.stringify(value));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Sicherung ist zu gross'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('Ungültiges JSON')); }
    });
    req.on('error', reject);
  });
}

function encryptPayload(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', pairingKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

function decryptPayload(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', pairingKey, Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8'));
}

function cleanupPairings() {
  db.prepare('DELETE FROM pairings WHERE expires_at <= ?').run(Date.now());
}

function imageItems(data) {
  const items = [];
  if (data?.current && typeof data.current === 'object') items.push(data.current);
  if (Array.isArray(data?.history)) items.push(...data.history.filter(Boolean));
  return items;
}

function imageExtension(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function extractImages(data) {
  const clean = clone(data);
  for (const item of imageItems(clean)) {
    const match = typeof item.imageData === 'string'
      ? item.imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
      : null;
    if (!match) continue;
    const mime = match[1];
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
      delete item.imageData;
      continue;
    }
    const base = String(item.id || crypto.randomUUID()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || crypto.randomUUID();
    const filename = `${base}.${imageExtension(mime)}`;
    const target = path.join(IMAGE_DIR, filename);
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, bytes);
    fs.renameSync(temp, target);
    item.imageRef = filename;
    item.imageMime = mime;
    delete item.imageData;
  }
  return clean;
}

function hydrateImages(data) {
  const hydrated = clone(data);
  for (const item of imageItems(hydrated)) {
    if (!item.imageRef || !/^[A-Za-z0-9_.-]+$/.test(item.imageRef)) continue;
    const filename = path.join(IMAGE_DIR, item.imageRef);
    if (!fs.existsSync(filename)) continue;
    try {
      const mime = item.imageMime || (item.imageRef.endsWith('.png') ? 'image/png' : item.imageRef.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      item.imageData = `data:${mime};base64,${fs.readFileSync(filename).toString('base64')}`;
    } catch {}
  }
  return hydrated;
}

function collectImageRefs(data) {
  const refs = new Set();
  for (const item of imageItems(data)) {
    if (item?.imageRef && /^[A-Za-z0-9_.-]+$/.test(item.imageRef)) refs.add(item.imageRef);
  }
  return refs;
}

function cleanupOrphanImages() {
  const referenced = new Set();
  for (const row of db.prepare('SELECT data_json FROM datasets').all()) {
    try { for (const ref of collectImageRefs(JSON.parse(row.data_json))) referenced.add(ref); }
    catch {}
  }
  for (const name of fs.readdirSync(IMAGE_DIR)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name) || referenced.has(name)) continue;
    try { fs.unlinkSync(path.join(IMAGE_DIR, name)); } catch {}
  }
}

function safeProfileId(value) {
  const id = String(value || '').trim();
  return id.length >= 3 && id.length <= 140 && /^[A-Za-z0-9._:-]+$/.test(id) ? id : null;
}

function profileUsedInData(profileId, data) {
  const containers = [data?.current, ...(Array.isArray(data?.history) ? data.history : [])].filter(Boolean);
  return containers.some(container => recordPlayerIds(container, data).includes(profileId));
}

function writeServerResetBackup(rows, registryRows = profileRegistryRows()) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const relative = path.join('backups', 'server-reset', stamp);
  const dir = path.join(DATA_DIR, relative);
  fs.mkdirSync(dir, { recursive: true });
  const summary = { version: VERSION, createdAt: nowIso(), datasets: [] };
  for (const row of rows) {
    try {
      const hydrated = hydrateImages(JSON.parse(row.data_json));
      fs.writeFileSync(path.join(dir, `${row.code}.json`), JSON.stringify({ code: row.code, updatedAt: row.updated_at, data: hydrated }, null, 2));
      summary.datasets.push({ code: row.code, updatedAt: row.updated_at });
    } catch (error) {
      summary.datasets.push({ code: row.code, updatedAt: row.updated_at, error: error.message });
    }
  }
  const registryProfiles = [];
  for (const row of registryRows) {
    try { registryProfiles.push(JSON.parse(row.profile_json)); } catch {}
  }
  fs.writeFileSync(path.join(dir, 'profiles.json'), JSON.stringify(registryProfiles, null, 2));
  summary.profileCount = registryProfiles.length;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(summary, null, 2));
  return relative.split(path.sep).join('/');
}

function writeBackup(code, storedData) {
  if (!storedData) return;
  const dir = path.join(BACKUP_DIR, code);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(storedData));
  const backups = fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort()
    .reverse();
  backups.slice(20).forEach(name => { try { fs.unlinkSync(path.join(dir, name)); } catch {} });
}

function migrateLegacyFiles() {
  const insert = db.prepare('INSERT OR IGNORE INTO datasets(code, data_json, updated_at) VALUES (?, ?, ?)');
  for (const name of fs.readdirSync(DATA_DIR)) {
    const match = name.match(/^([A-Za-z0-9_-]{3,40})\.json$/);
    if (!match) continue;
    const source = path.join(DATA_DIR, name);
    try {
      const legacy = JSON.parse(fs.readFileSync(source, 'utf8'));
      const data = extractImages(legacy.data || legacy);
      insert.run(match[1], JSON.stringify(data), legacy.updatedAt || nowIso());
      const legacyDir = path.join(BACKUP_DIR, 'legacy');
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.renameSync(source, path.join(legacyDir, `${Date.now()}-${name}`));
    } catch (error) {
      console.warn(`Legacy-Datei ${name} konnte nicht migriert werden:`, error.message);
    }
  }
}
migrateLegacyFiles();

function upsertProfileRegistry(profiles) {
  const select = db.prepare('SELECT updated_at FROM profiles WHERE id = ?');
  const insert = db.prepare(`
    INSERT INTO profiles(id, profile_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at
  `);
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const id = safeProfileId(profile?.id);
    if (!id || !profile?.name) continue;
    const updatedAt = String(profile.updatedAt || profile.createdAt || nowIso());
    const existing = select.get(id);
    if (existing && Date.parse(existing.updated_at || 0) > Date.parse(updatedAt || 0)) continue;
    insert.run(id, JSON.stringify(profile), updatedAt);
  }
}

function rebuildProfileRegistry() {
  for (const row of db.prepare('SELECT data_json FROM datasets').all()) {
    try { upsertProfileRegistry(JSON.parse(row.data_json)?.profiles); } catch {}
  }
}

function profileRegistryRows() {
  return db.prepare('SELECT id, profile_json, updated_at FROM profiles ORDER BY id').all();
}

function writeProfileBackup(profileId, registryProfile, parsedRows) {
  const dir = path.join(BACKUP_DIR, 'profiles', profileId);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const datasets = [];
  for (const row of parsedRows) {
    if (!(Array.isArray(row.data?.profiles) ? row.data.profiles : []).some(profile => String(profile?.id || '') === profileId)) continue;
    datasets.push({ code: row.code, updatedAt: row.updated_at, data: hydrateImages(row.data) });
  }
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify({
    version: VERSION,
    createdAt: nowIso(),
    profile: registryProfile || null,
    datasets
  }, null, 2));
  const backups = fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort().reverse();
  backups.slice(20).forEach(name => { try { fs.unlinkSync(path.join(dir, name)); } catch {} });
  return `backups/profiles/${profileId}/${stamp}.json`;
}

function profileNameMap(data) {
  const map = new Map();
  for (const profile of Array.isArray(data?.profiles) ? data.profiles : []) {
    if (profile?.id && profile?.name) map.set(String(profile.name).trim().toLocaleLowerCase('de-CH'), String(profile.id));
  }
  return map;
}

function recordPlayerIds(record, data) {
  if (Array.isArray(record?.playerIds) && record.playerIds.length) return record.playerIds.map(String);
  const byName = profileNameMap(data);
  return (Array.isArray(record?.players) ? record.players : []).map(name => byName.get(String(name).trim().toLocaleLowerCase('de-CH')) || `legacy-${crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 16)}`);
}

function aggregateCatalog() {
  const rows = db.prepare('SELECT code, data_json, updated_at FROM datasets ORDER BY code COLLATE NOCASE').all();
  const profiles = new Map();
  for (const row of profileRegistryRows()) {
    try {
      const profile = JSON.parse(row.profile_json);
      if (profile?.id && profile?.name) profiles.set(String(profile.id), profile);
    } catch {}
  }
  const stats = new Map();
  const areas = [];

  const ensureStats = id => {
    if (!stats.has(id)) stats.set(id, { games: 0, wins: 0, shared: 0, totalPoints: 0, high: 0, low: null, bonusCount: 0, yatzyCount: 0, areas: new Set() });
    return stats.get(id);
  };

  for (const row of rows) {
    let data;
    try { data = JSON.parse(row.data_json); } catch { continue; }
    const history = Array.isArray(data.history) ? data.history : [];
    areas.push({ code: row.code, updatedAt: row.updated_at, gameCount: history.length });

    for (const profile of Array.isArray(data.profiles) ? data.profiles : []) {
      if (!profile?.id || !profile?.name) continue;
      const id = String(profile.id);
      const existing = profiles.get(id);
      if (!existing || Date.parse(profile.updatedAt || 0) >= Date.parse(existing.updatedAt || 0)) profiles.set(id, profile);
    }

    for (const record of history) {
      const ids = recordPlayerIds(record, data);
      const winners = Array.isArray(record.winners) ? record.winners.map(Number) : Number.isInteger(record.winner) ? [record.winner] : [];
      ids.forEach((id, index) => {
        const total = Number(record.totals?.[index]?.total || 0);
        const entry = ensureStats(id);
        entry.games += 1;
        entry.totalPoints += total;
        entry.high = Math.max(entry.high, total);
        entry.low = entry.low === null ? total : Math.min(entry.low, total);
        if (Number(record.totals?.[index]?.bonus || 0) > 0) entry.bonusCount += 1;
        if (Number(record.scores?.[index]?.yatzy || 0) > 0) entry.yatzyCount += 1;
        if (winners.length === 1 && winners[0] === index) entry.wins += 1;
        else if (winners.length > 1 && winners.includes(index)) entry.shared += 1;
        entry.areas.add(row.code);
      });
    }
  }

  const statsByProfile = {};
  for (const [id, value] of stats) {
    statsByProfile[id] = {
      games: value.games,
      wins: value.wins,
      shared: value.shared,
      average: value.games ? Math.round(value.totalPoints / value.games) : 0,
      high: value.high,
      low: value.low ?? 0,
      bonusRate: value.games ? Math.round(value.bonusCount / value.games * 100) : 0,
      yatzyCount: value.yatzyCount,
      areaCount: value.areas.size
    };
  }

  return {
    version: VERSION,
    updatedAt: nowIso(),
    codes: areas.map(area => area.code),
    areas,
    profiles: [...profiles.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de-CH')),
    statsByProfile
  };
}

function pairingRow(token) {
  cleanupPairings();
  return db.prepare('SELECT * FROM pairings WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), Date.now());
}

const requestBuckets = new Map();
function rateLimited(req, limit = 80) {
  const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown');
  const bucket = requestBuckets.get(ip) || { start: Date.now(), count: 0 };
  if (Date.now() - bucket.start > 60 * 60 * 1000) { bucket.start = Date.now(); bucket.count = 0; }
  bucket.count += 1;
  requestBuckets.set(ip, bucket);
  return bucket.count > limit;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      service: 'yatzy-duell-sync',
      version: VERSION,
      storage: { database: 'database/yatzy.sqlite', images: 'images/', backups: 'backups/', config: 'config/' }
    });
  }

  if (url.pathname === '/api/catalog' && req.method === 'GET') {
    try { return json(res, 200, aggregateCatalog()); }
    catch (error) { return json(res, 500, { error: error.message || 'Katalog konnte nicht geladen werden' }); }
  }

  if (url.pathname === '/api/pair' && req.method === 'POST') {
    if (rateLimited(req, 30)) return json(res, 429, { error: 'Zu viele Kopplungsversuche' });
    try {
      const body = await readBody(req);
      const config = body?.config;
      const appUrl = String(body?.appUrl || '').trim();
      if (!config || typeof config !== 'object') return json(res, 400, { error: 'Einrichtung fehlt' });
      if (!/^https?:\/\//.test(String(config.syncUrl || ''))) return json(res, 400, { error: 'Serveradresse fehlt' });
      if (!/^https?:\/\//.test(appUrl)) return json(res, 400, { error: 'App-Adresse fehlt' });
      const token = crypto.randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + PAIR_TTL_MS;
      const encrypted = encryptPayload({ config, appUrl });
      db.prepare('INSERT INTO pairings(token_hash, ciphertext, iv, auth_tag, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(tokenHash(token), encrypted.ciphertext, encrypted.iv, encrypted.authTag, expiresAt, Date.now());
      const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
      const protocol = forwardedProto || url.protocol.replace(':', '') || 'http';
      const origin = `${protocol}://${req.headers.host}`;
      return json(res, 201, {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        openUrl: `${origin}/api/pair/open/${token}`
      });
    } catch (error) {
      return json(res, 400, { error: error.message || 'Kopplung konnte nicht erstellt werden' });
    }
  }

  const openPairMatch = url.pathname.match(/^\/api\/pair\/open\/([^/]+)$/);
  if (openPairMatch && req.method === 'GET') {
    if (rateLimited(req)) return html(res, 429, '<h1>Zu viele Anfragen</h1>');
    const token = safeToken(decodeURIComponent(openPairMatch[1]));
    if (!token) return html(res, 400, '<h1>Ungültiger Kopplungscode</h1>');
    const row = pairingRow(token);
    if (!row) return html(res, 410, '<h1>Kopplung abgelaufen</h1><p>Erstelle auf dem bisherigen Gerät einen neuen QR-Code.</p>');
    try {
      const payload = decryptPayload(row);
      const fragment = Buffer.from(JSON.stringify({ server: payload.config.syncUrl, token })).toString('base64url');
      const target = new URL(payload.appUrl);
      target.hash = `pair=${fragment}`;
      return redirect(res, target.toString());
    } catch {
      return html(res, 500, '<h1>Kopplung konnte nicht geöffnet werden</h1>');
    }
  }

  const redeemPairMatch = url.pathname.match(/^\/api\/pair\/redeem\/([^/]+)$/);
  if (redeemPairMatch && req.method === 'GET') {
    if (rateLimited(req)) return json(res, 429, { error: 'Zu viele Anfragen' });
    const token = safeToken(decodeURIComponent(redeemPairMatch[1]));
    if (!token) return json(res, 400, { error: 'Ungültiger Kopplungscode' });
    const row = pairingRow(token);
    if (!row) return json(res, 410, { error: 'Kopplung ist abgelaufen oder wurde bereits verwendet' });
    try {
      const payload = decryptPayload(row);
      db.prepare('DELETE FROM pairings WHERE token_hash = ?').run(tokenHash(token));
      return json(res, 200, { config: payload.config });
    } catch {
      db.prepare('DELETE FROM pairings WHERE token_hash = ?').run(tokenHash(token));
      return json(res, 500, { error: 'Kopplung konnte nicht entschlüsselt werden' });
    }
  }

  const areaDeleteMatch = url.pathname.match(/^\/api\/areas\/([^/]+)$/);
  if (areaDeleteMatch && req.method === 'DELETE') {
    const code = safeCode(decodeURIComponent(areaDeleteMatch[1]));
    if (!code) return json(res, 400, { error: 'Ungültiger Spielcode' });
    const stored = db.prepare('SELECT data_json, updated_at FROM datasets WHERE code = ?').get(code);
    if (!stored) return json(res, 404, { error: 'Spielbereich nicht gefunden' });
    try {
      const hydrated = hydrateImages(JSON.parse(stored.data_json));
      writeBackup(code, hydrated);
      db.prepare('DELETE FROM datasets WHERE code = ?').run(code);
      cleanupOrphanImages();
      return json(res, 200, { ok: true, code, backup: `backups/${code}/` });
    } catch (error) {
      return json(res, 500, { error: error.message || 'Spielbereich konnte nicht gelöscht werden' });
    }
  }

  const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)(?:\/(archive|restore))?$/);
  if (profileMatch) {
    const profileId = safeProfileId(decodeURIComponent(profileMatch[1]));
    const action = profileMatch[2] || '';
    if (!profileId) return json(res, 400, { error: 'Ungültige Spieler-ID' });
    const rows = db.prepare('SELECT code, data_json, updated_at FROM datasets ORDER BY code COLLATE NOCASE').all();
    const parsed = [];
    const registryRow = db.prepare('SELECT profile_json, updated_at FROM profiles WHERE id = ?').get(profileId);
    let registryProfile = null;
    try { registryProfile = registryRow ? JSON.parse(registryRow.profile_json) : null; } catch {}
    let found = Boolean(registryRow);
    const usedAreas = [];
    for (const row of rows) {
      try {
        const data = JSON.parse(row.data_json);
        if ((Array.isArray(data.profiles) ? data.profiles : []).some(profile => String(profile?.id || '') === profileId)) found = true;
        if (profileUsedInData(profileId, data)) usedAreas.push(row.code);
        parsed.push({ ...row, data });
      } catch {}
    }
    if (!found) return json(res, 404, { error: 'Spielerprofil nicht gefunden' });

    if (req.method === 'DELETE' && !action) {
      if (usedAreas.length) return json(res, 409, { error: 'Spielerprofil wird noch in Spielen verwendet', used: true, areas: usedAreas });
      try {
        const backup = writeProfileBackup(profileId, registryProfile, parsed);
        let changed = 0;
        const stamp = nowIso();
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const row of parsed) {
            const before = Array.isArray(row.data.profiles) ? row.data.profiles.length : 0;
            if (!(Array.isArray(row.data.profiles) ? row.data.profiles : []).some(profile => String(profile?.id || '') === profileId)) continue;
            writeBackup(row.code, hydrateImages(row.data));
            row.data.profiles = row.data.profiles.filter(profile => String(profile?.id || '') !== profileId);
            if (row.data.settings?.selectedProfileIds) row.data.settings.selectedProfileIds = row.data.settings.selectedProfileIds.filter(id => String(id) !== profileId);
            if (row.data.profiles.length === before) continue;
            row.data.updatedAt = stamp;
            db.prepare('UPDATE datasets SET data_json = ?, updated_at = ? WHERE code = ?').run(JSON.stringify(row.data), stamp, row.code);
            changed += 1;
          }
          db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        cleanupOrphanImages();
        return json(res, 200, { ok: true, profileId, changedAreas: changed, backup });
      } catch (error) {
        return json(res, 500, { error: error.message || 'Spielerprofil konnte nicht gelöscht werden' });
      }
    }

    if (req.method === 'POST' && (action === 'archive' || action === 'restore')) {
      try {
        const archived = action === 'archive';
        const stamp = nowIso();
        const backup = writeProfileBackup(profileId, registryProfile, parsed);
        let changed = 0;
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const row of parsed) {
            const profile = (Array.isArray(row.data.profiles) ? row.data.profiles : []).find(item => String(item?.id || '') === profileId);
            if (!profile || Boolean(profile.archived) === archived) continue;
            writeBackup(row.code, hydrateImages(row.data));
            profile.archived = archived;
            profile.updatedAt = stamp;
            if (archived && row.data.settings?.selectedProfileIds) row.data.settings.selectedProfileIds = row.data.settings.selectedProfileIds.filter(id => String(id) !== profileId);
            row.data.updatedAt = stamp;
            db.prepare('UPDATE datasets SET data_json = ?, updated_at = ? WHERE code = ?').run(JSON.stringify(row.data), stamp, row.code);
            changed += 1;
          }
          const nextRegistryProfile = registryProfile || parsed.flatMap(row => Array.isArray(row.data?.profiles) ? row.data.profiles : []).find(profile => String(profile?.id || '') === profileId);
          if (nextRegistryProfile) {
            nextRegistryProfile.archived = archived;
            nextRegistryProfile.updatedAt = stamp;
            db.prepare(`
              INSERT INTO profiles(id, profile_json, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at
            `).run(profileId, JSON.stringify(nextRegistryProfile), stamp);
          }
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return json(res, 200, { ok: true, profileId, archived, changedAreas: changed, backup });
      } catch (error) {
        return json(res, 500, { error: error.message || 'Spielerprofil konnte nicht geändert werden' });
      }
    }

    return json(res, 405, { error: 'Methode nicht erlaubt' });
  }

  if (url.pathname === '/api/reset' && req.method === 'DELETE') {
    try {
      const rows = db.prepare('SELECT code, data_json, updated_at FROM datasets ORDER BY code COLLATE NOCASE').all();
      const backup = writeServerResetBackup(rows);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM pairings').run();
        db.prepare('DELETE FROM datasets').run();
        db.prepare('DELETE FROM profiles').run();
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      cleanupOrphanImages();
      try { db.exec('VACUUM'); } catch {}
      return json(res, 200, { ok: true, deletedAreas: rows.length, backup });
    } catch (error) {
      return json(res, 500, { error: error.message || 'Server konnte nicht zurückgesetzt werden' });
    }
  }

  const syncMatch = url.pathname.match(/^\/api\/sync\/([^/]+)$/);
  if (syncMatch) {
    const code = safeCode(decodeURIComponent(syncMatch[1]));
    if (!code) return json(res, 400, { error: 'Ungültiger Spielcode' });
    const stored = db.prepare('SELECT data_json, updated_at FROM datasets WHERE code = ?').get(code);

    if (req.method === 'GET') {
      if (!stored) return json(res, 404, { error: 'Noch keine Sicherung' });
      try { return json(res, 200, { data: hydrateImages(JSON.parse(stored.data_json)), updatedAt: stored.updated_at }); }
      catch { return json(res, 500, { error: 'Gespeicherte Daten sind beschädigt' }); }
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        if (!body.data || typeof body.data !== 'object') return json(res, 400, { error: 'Daten fehlen' });
        if (stored) {
          try { writeBackup(code, hydrateImages(JSON.parse(stored.data_json))); } catch {}
        }
        const cleaned = extractImages(body.data);
        const updatedAt = nowIso();
        db.exec('BEGIN IMMEDIATE');
        try {
          upsertProfileRegistry(cleaned.profiles);
          db.prepare(`
            INSERT INTO datasets(code, data_json, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
          `).run(code, JSON.stringify(cleaned), updatedAt);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return json(res, 200, { ok: true, updatedAt });
      } catch (error) {
        return json(res, 400, { error: error.message || 'Speichern fehlgeschlagen' });
      }
    }

    return json(res, 405, { error: 'Methode nicht erlaubt' });
  }

  return json(res, 404, { error: 'Nicht gefunden' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Yatzy Sync ${VERSION} läuft auf Port ${PORT}`);
  console.log(`Datenpfad: ${DATA_DIR}`);
});
