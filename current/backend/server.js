const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || '/data');
const DB_DIR = path.join(DATA_DIR, 'database');
const IMAGE_DIR = path.join(DATA_DIR, 'images');
const BADGE_IMAGE_DIR = path.join(DATA_DIR, 'badge-images');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DB_DIR, 'yatzy.sqlite');
const MAX_BODY = Number(process.env.MAX_BODY_BYTES || 40 * 1024 * 1024);
const VERSION = '2.4.3';

for (const dir of [DATA_DIR, DB_DIR, IMAGE_DIR, BADGE_IMAGE_DIR, BACKUP_DIR]) fs.mkdirSync(dir, { recursive: true });

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
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    profile_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_profiles_updated ON profiles(updated_at);
  CREATE TABLE IF NOT EXISTS badge_images (
    badge_key TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);


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


const safeCode = value => /^[A-Za-z0-9_-]{3,40}$/.test(value || '') ? value : null;
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


const BADGE_IMAGE_KEYS = new Set(['games','wins','yatzys','bonus','noStrike','fullHouse','smallStraight','largeStraight','yatzy1','yatzy2','yatzy3','yatzy4','yatzy5','yatzy6','rainbow']);

function safeBadgeKey(value) {
  const key = String(value || '').trim();
  return BADGE_IMAGE_KEYS.has(key) ? key : null;
}

function badgeImageExtension(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function parseBadgeImageData(value) {
  const match = typeof value === 'string'
    ? value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
    : null;
  if (!match) throw new Error('Ungültiges Badge-Bild');
  const mime = match[1];
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Badge-Bild ist zu gross');
  return { mime, bytes };
}

function badgeImagesUpdatedAt() {
  const row = db.prepare('SELECT MAX(updated_at) AS updated_at FROM badge_images').get();
  return row?.updated_at || null;
}

function readBadgeImages() {
  const images = {};
  let updatedAt = '';
  for (const row of db.prepare('SELECT badge_key, filename, mime, updated_at FROM badge_images ORDER BY badge_key').all()) {
    const key = safeBadgeKey(row.badge_key);
    if (!key || !/^[A-Za-z0-9_.-]+$/.test(row.filename || '')) continue;
    const filename = path.join(BADGE_IMAGE_DIR, row.filename);
    if (!fs.existsSync(filename)) continue;
    try {
      images[key] = `data:${row.mime};base64,${fs.readFileSync(filename).toString('base64')}`;
      if (!updatedAt || Date.parse(row.updated_at || 0) > Date.parse(updatedAt || 0)) updatedAt = row.updated_at;
    } catch {}
  }
  return { images, updatedAt: updatedAt || null };
}

function backupBadgeImage(key, row) {
  if (!row?.filename || !/^[A-Za-z0-9_.-]+$/.test(row.filename)) return null;
  const source = path.join(BADGE_IMAGE_DIR, row.filename);
  if (!fs.existsSync(source)) return null;
  const dir = path.join(BACKUP_DIR, 'badge-images', key);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `${stamp}.${badgeImageExtension(row.mime)}`);
  fs.copyFileSync(source, target);
  return path.relative(DATA_DIR, target).split(path.sep).join('/');
}

function removeBadgeImageFile(row) {
  if (!row?.filename || !/^[A-Za-z0-9_.-]+$/.test(row.filename)) return;
  try { fs.unlinkSync(path.join(BADGE_IMAGE_DIR, row.filename)); } catch {}
}

function normalisedProfileName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('de-CH');
}

function isGenericProfileName(value) {
  const name = normalisedProfileName(value);
  return /^spieler(?:in)?\s+\d+$/.test(name) || /^(gast|guest)\s*\d*$/.test(name);
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
  const badgeRows = db.prepare('SELECT badge_key, filename, mime, updated_at FROM badge_images ORDER BY badge_key').all();
  const badgeDir = path.join(dir, 'badge-images');
  if (badgeRows.length) fs.mkdirSync(badgeDir, { recursive: true });
  summary.badgeImages = [];
  for (const row of badgeRows) {
    if (!safeBadgeKey(row.badge_key) || !/^[A-Za-z0-9_.-]+$/.test(row.filename || '')) continue;
    const source = path.join(BADGE_IMAGE_DIR, row.filename);
    if (!fs.existsSync(source)) continue;
    const target = path.join(badgeDir, row.filename);
    fs.copyFileSync(source, target);
    summary.badgeImages.push({ key: row.badge_key, filename: row.filename, mime: row.mime, updatedAt: row.updated_at });
  }
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

function profileIdsByName(data) {
  const map = new Map();
  for (const profile of Array.isArray(data?.profiles) ? data.profiles : []) {
    const id = String(profile?.id || '').trim();
    const nameKey = normalisedProfileName(profile?.name);
    if (!id || !nameKey) continue;
    if (!map.has(nameKey)) map.set(nameKey, new Set());
    map.get(nameKey).add(id);
  }
  return map;
}

function legacyProfileId(name) {
  const identity = normalisedProfileName(name) || String(name || 'unbekannt');
  return `legacy-${crypto.createHash('sha1').update(identity).digest('hex').slice(0, 16)}`;
}

function recordParticipants(record, data) {
  const names = Array.isArray(record?.players) ? record.players.map(value => String(value || '').trim()) : [];
  const explicitIds = Array.isArray(record?.playerIds) ? record.playerIds : [];
  const count = Math.max(names.length, explicitIds.length, Array.isArray(record?.scores) ? record.scores.length : 0);
  const byName = profileIdsByName(data);
  return Array.from({ length: count }, (_, index) => {
    const name = names[index] || data?.profiles?.find(profile => String(profile?.id || '') === String(explicitIds[index] || ''))?.name || `Spieler ${index + 1}`;
    const explicit = String(explicitIds[index] || '').trim();
    if (explicit) return { id: explicit, name };
    const candidates = [...(byName.get(normalisedProfileName(name)) || [])];
    return { id: candidates.length === 1 ? candidates[0] : legacyProfileId(name), name };
  });
}

function recordPlayerIds(record, data) {
  return recordParticipants(record, data).map(participant => participant.id);
}

const BADGE_SCORE_CATEGORIES = ['ones','twos','threes','fours','fives','sixes','onePair','twoPairs','threeKind','fourKind','smallStraight','largeStraight','fullHouse','chance','yatzy'];

function badgeKeysForRecord(record, index, winners) {
  const keys = ['games'];
  const scores = record?.scores?.[index] || {};
  if (winners.length === 1 && winners[0] === index) keys.push('wins');
  if (Number(scores.yatzy || 0) > 0) keys.push('yatzys');
  if (Number(record?.totals?.[index]?.bonus || 0) > 0) keys.push('bonus');
  if (BADGE_SCORE_CATEGORIES.every(category => Number(scores[category] || 0) > 0)) keys.push('noStrike');
  if (Number(scores.fullHouse || 0) > 0) keys.push('fullHouse');
  if (Number(scores.smallStraight || 0) > 0) keys.push('smallStraight');
  if (Number(scores.largeStraight || 0) > 0) keys.push('largeStraight');
  const yatzyFace = Number(record?.yatzyFaces?.[index] || 0);
  if (Number(scores.yatzy || 0) > 0 && yatzyFace >= 1 && yatzyFace <= 6) keys.push(`yatzy${yatzyFace}`);
  return { keys, yatzyFace: yatzyFace >= 1 && yatzyFace <= 6 ? yatzyFace : 0 };
}

const BADGE_KEYS = ['games','wins','yatzys','bonus','noStrike','fullHouse','smallStraight','largeStraight','yatzy1','yatzy2','yatzy3','yatzy4','yatzy5','yatzy6'];
const BADGE_LEVEL_THRESHOLDS = { bronze: 1, silver: 10, gold: 25, platinum: 100 };

function badgeSummaryForEvents(events) {
  const sorted = [...(Array.isArray(events) ? events : [])].sort((a, b) => Date.parse(a?.finishedAt || 0) - Date.parse(b?.finishedAt || 0));
  const counts = Object.fromEntries(BADGE_KEYS.map(key => [key, 0]));
  const datesByKey = Object.fromEntries(BADGE_KEYS.map(key => [key, []]));
  const areaGames = {};
  const rainbowFaces = new Set();
  let rainbowCompletedAt = '';
  let rainbowLastAt = '';

  for (const event of sorted) {
    const keys = Array.isArray(event?.keys) ? [...new Set(event.keys.map(String))] : [];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(counts, key)) continue;
      counts[key] += 1;
      if (event.finishedAt) datesByKey[key].push(event.finishedAt);
    }
    if (keys.includes('games')) {
      const area = String(event?.area || 'unbekannt');
      areaGames[area] = (areaGames[area] || 0) + 1;
    }
    const face = Number(event?.yatzyFace || 0);
    if (face >= 1 && face <= 6 && keys.includes(`yatzy${face}`)) {
      rainbowFaces.add(face);
      rainbowLastAt = event.finishedAt || rainbowLastAt;
      if (!rainbowCompletedAt && rainbowFaces.size === 6) rainbowCompletedAt = event.finishedAt || '';
    }
  }

  const milestones = {};
  for (const key of BADGE_KEYS) {
    const dates = datesByKey[key];
    milestones[key] = {
      firstAt: dates[0] || '',
      lastAt: dates.at(-1) || '',
      bronzeAt: dates[BADGE_LEVEL_THRESHOLDS.bronze - 1] || '',
      silverAt: dates[BADGE_LEVEL_THRESHOLDS.silver - 1] || '',
      goldAt: dates[BADGE_LEVEL_THRESHOLDS.gold - 1] || '',
      platinumAt: dates[BADGE_LEVEL_THRESHOLDS.platinum - 1] || ''
    };
  }

  return {
    counts,
    gameCount: counts.games,
    areaCount: Object.keys(areaGames).length,
    areaGames: Object.fromEntries(Object.entries(areaGames).sort((a, b) => a[0].localeCompare(b[0], 'de-CH'))),
    milestones,
    rainbowFaces: [...rainbowFaces].sort((a, b) => a - b),
    rainbowCompletedAt,
    rainbowLastAt
  };
}

function aggregateCatalog() {
  const rows = db.prepare('SELECT code, data_json, updated_at FROM datasets ORDER BY code COLLATE NOCASE').all();
  const parsedRows = [];
  const profiles = new Map();

  for (const row of profileRegistryRows()) {
    try {
      const profile = JSON.parse(row.profile_json);
      if (profile?.id && profile?.name) profiles.set(String(profile.id), profile);
    } catch {}
  }

  for (const row of rows) {
    try {
      const data = JSON.parse(row.data_json);
      parsedRows.push({ ...row, data });
      for (const profile of Array.isArray(data.profiles) ? data.profiles : []) {
        if (!profile?.id || !profile?.name) continue;
        const id = String(profile.id);
        const existing = profiles.get(id);
        if (!existing || Date.parse(profile.updatedAt || 0) >= Date.parse(existing.updatedAt || 0)) profiles.set(id, profile);
      }
    } catch {}
  }

  const usageById = new Map();
  const areasById = new Map();
  const idsByName = new Map();
  const namesById = new Map();
  const conflictingNames = new Set();

  const registerIdentity = (idValue, nameValue, area = '') => {
    const id = String(idValue || '').trim();
    const nameKey = normalisedProfileName(nameValue);
    if (!id || !nameKey) return;
    if (!idsByName.has(nameKey)) idsByName.set(nameKey, new Set());
    idsByName.get(nameKey).add(id);
    if (!namesById.has(id)) namesById.set(id, new Map());
    namesById.get(id).set(nameKey, (namesById.get(id).get(nameKey) || 0) + 1);
    if (area) {
      if (!areasById.has(id)) areasById.set(id, new Set());
      areasById.get(id).add(area);
    }
  };

  for (const [id, profile] of profiles) registerIdentity(id, profile.name);

  for (const row of parsedRows) {
    const data = row.data;
    for (const record of Array.isArray(data.history) ? data.history : []) {
      const participants = recordParticipants(record, data);
      const seenNames = new Map();
      participants.forEach(participant => {
        registerIdentity(participant.id, participant.name, row.code);
        usageById.set(participant.id, (usageById.get(participant.id) || 0) + 1);
        const nameKey = normalisedProfileName(participant.name);
        if (!seenNames.has(nameKey)) seenNames.set(nameKey, new Set());
        seenNames.get(nameKey).add(participant.id);
      });
      for (const [nameKey, idsForName] of seenNames) {
        if (nameKey && idsForName.size > 1) conflictingNames.add(nameKey);
      }
    }
  }

  const profileAliases = {};
  const canonicalByName = new Map();
  for (const [nameKey, idSet] of idsByName) {
    const ids = [...idSet];
    if (!ids.length || conflictingNames.has(nameKey) || isGenericProfileName(nameKey)) continue;
    ids.sort((a, b) => {
      const areaDiff = (areasById.get(b)?.size || 0) - (areasById.get(a)?.size || 0);
      if (areaDiff) return areaDiff;
      const usageDiff = (usageById.get(b) || 0) - (usageById.get(a) || 0);
      if (usageDiff) return usageDiff;
      const aProfile = profiles.get(a);
      const bProfile = profiles.get(b);
      const createdDiff = Date.parse(aProfile?.createdAt || 0) - Date.parse(bProfile?.createdAt || 0);
      if (createdDiff) return createdDiff;
      const registeredDiff = Number(Boolean(bProfile)) - Number(Boolean(aProfile));
      if (registeredDiff) return registeredDiff;
      return String(a).localeCompare(String(b));
    });
    const canonical = ids[0];
    canonicalByName.set(nameKey, canonical);
    ids.slice(1).forEach(id => { profileAliases[id] = canonical; });
  }

  const profileIdByName = Object.fromEntries(canonicalByName.entries());
  const canonicalId = (idValue, name = '') => {
    let current = String(idValue || '').trim();
    const visited = new Set();
    while (profileAliases[current] && !visited.has(current)) {
      visited.add(current);
      current = String(profileAliases[current]);
    }
    const nameKey = normalisedProfileName(name || profiles.get(current)?.name || '');
    const byName = nameKey && !conflictingNames.has(nameKey) && !isGenericProfileName(nameKey) ? canonicalByName.get(nameKey) : '';
    return byName || current || legacyProfileId(name);
  };

  // Eine einzige kanonische Spiel-Liste pro Profil ist die Quelle für Statistik UND Badges.
  // Dadurch können sich Spielanzahl, Bereichsanzahl und Badge-Zähler nicht mehr unterscheiden.
  const ledgerByProfile = new Map();
  const areas = [];
  const ensureLedger = id => {
    if (!ledgerByProfile.has(id)) ledgerByProfile.set(id, new Map());
    return ledgerByProfile.get(id);
  };
  const recordIdentity = (row, record) => {
    const explicit = String(record?.id || '').trim();
    if (explicit) return explicit;
    const fingerprint = JSON.stringify({
      finishedAt: record?.finishedAt || '',
      startedAt: record?.startedAt || '',
      players: record?.players || [],
      playerIds: record?.playerIds || [],
      totals: record?.totals || []
    });
    return `legacy-${crypto.createHash('sha1').update(`${row.code}:${fingerprint}`).digest('hex').slice(0, 20)}`;
  };

  for (const row of parsedRows) {
    const data = row.data;
    const history = Array.isArray(data.history) ? data.history : [];
    areas.push({ code: row.code, updatedAt: row.updated_at, gameCount: history.length });
    for (const record of history) {
      const participants = recordParticipants(record, data);
      const winners = Array.isArray(record.winners) ? record.winners.map(Number) : Number.isInteger(record.winner) ? [record.winner] : [];
      const recordId = recordIdentity(row, record);
      const finishedAt = record?.finishedAt || record?.startedAt || row.updated_at;
      participants.forEach((participant, index) => {
        const id = canonicalId(participant.id, participant.name);
        if (!id) return;
        const total = Number(record.totals?.[index]?.total || 0);
        const bonus = Number(record.totals?.[index]?.bonus || 0);
        const yatzy = Number(record.scores?.[index]?.yatzy || 0);
        const badgeData = badgeKeysForRecord(record, index, winners);
        const outcome = winners.length === 1 && winners[0] === index ? 'win' : winners.length > 1 && winners.includes(index) ? 'shared' : 'loss';
        const entry = {
          id: recordId,
          area: row.code,
          finishedAt,
          total,
          bonus,
          yatzy,
          outcome,
          keys: badgeData.keys,
          yatzyFace: badgeData.yatzyFace
        };
        const key = `${row.code}:${recordId}`;
        const ledger = ensureLedger(id);
        const previous = ledger.get(key);
        if (!previous || Date.parse(entry.finishedAt || 0) >= Date.parse(previous.finishedAt || 0)) ledger.set(key, entry);
      });
    }
  }

  const profileSummaries = {};
  const statsByProfile = {};
  const badgeEventsByProfile = {};
  const badgeStatsByProfile = {};
  const badgeAreaGamesByProfile = {};

  for (const [id, ledger] of ledgerByProfile) {
    const entries = [...ledger.values()].sort((a, b) => Date.parse(a.finishedAt || 0) - Date.parse(b.finishedAt || 0));
    const games = entries.length;
    const wins = entries.filter(entry => entry.outcome === 'win').length;
    const shared = entries.filter(entry => entry.outcome === 'shared').length;
    const totalPoints = entries.reduce((sum, entry) => sum + entry.total, 0);
    const totals = entries.map(entry => entry.total);
    const bonusCount = entries.filter(entry => entry.bonus > 0).length;
    const yatzyCount = entries.filter(entry => entry.yatzy > 0).length;
    const events = entries.map(entry => ({
      id: entry.id,
      area: entry.area,
      finishedAt: entry.finishedAt,
      keys: entry.keys,
      yatzyFace: entry.yatzyFace
    }));
    const badges = badgeSummaryForEvents(events);
    const areaGames = badges.areaGames;
    const summary = {
      games,
      wins,
      shared,
      losses: Math.max(0, games - wins - shared),
      average: games ? Math.round(totalPoints / games) : 0,
      high: totals.length ? Math.max(...totals) : 0,
      low: totals.length ? Math.min(...totals) : 0,
      bonusRate: games ? Math.round(bonusCount / games * 100) : 0,
      yatzyCount,
      areaCount: Object.keys(areaGames).length,
      areaGames,
      badges
    };

    // Harte Konsistenzgarantie: Beide Ansichten müssen dieselbe Spiel- und Bereichszahl liefern.
    if (summary.games !== summary.badges.gameCount || summary.areaCount !== summary.badges.areaCount) {
      throw new Error(`Inkonsistente Profilaggregation für ${id}`);
    }

    profileSummaries[id] = summary;
    statsByProfile[id] = summary;
    badgeEventsByProfile[id] = events;
    badgeStatsByProfile[id] = badges;
    badgeAreaGamesByProfile[id] = areaGames;
  }

  // Jede bekannte Alias-ID erhält exakt dasselbe Objekt und damit dieselbe Datengrundlage.
  for (const [alias, canonical] of Object.entries(profileAliases)) {
    if (profileSummaries[canonical]) profileSummaries[alias] = profileSummaries[canonical];
    if (statsByProfile[canonical]) statsByProfile[alias] = statsByProfile[canonical];
    if (badgeEventsByProfile[canonical]) badgeEventsByProfile[alias] = badgeEventsByProfile[canonical];
    if (badgeStatsByProfile[canonical]) badgeStatsByProfile[alias] = badgeStatsByProfile[canonical];
    if (badgeAreaGamesByProfile[canonical]) badgeAreaGamesByProfile[alias] = badgeAreaGamesByProfile[canonical];
  }

  const canonicalProfiles = new Map();
  for (const [id, profile] of profiles) {
    const canonical = canonicalId(id, profile.name);
    if (!canonical) continue;
    const current = canonicalProfiles.get(canonical);
    const preferred = profiles.get(canonical) || profile;
    if (!current || Date.parse(preferred.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) canonicalProfiles.set(canonical, { ...preferred, id: canonical });
  }

  return {
    version: VERSION,
    catalogSchema: 2,
    aggregation: 'canonical-profile-ledger',
    updatedAt: nowIso(),
    codes: areas.map(area => area.code),
    areas,
    profiles: [...canonicalProfiles.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de-CH')),
    profileAliases,
    profileIdByName,
    identityMergeCount: Object.keys(profileAliases).length,
    identityConflictNames: [...conflictingNames],
    profileSummaries,
    statsByProfile,
    badgeEventsByProfile,
    badgeStatsByProfile,
    badgeAreaGamesByProfile,
    badgeImagesUpdatedAt: badgeImagesUpdatedAt()
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      service: 'yatzy-duell-sync',
      version: VERSION,
      storage: { database: 'database/yatzy.sqlite', images: 'images/', badgeImages: 'badge-images/', backups: 'backups/' }
    });
  }

  if (url.pathname === '/api/catalog' && req.method === 'GET') {
    try { return json(res, 200, aggregateCatalog()); }
    catch (error) { return json(res, 500, { error: error.message || 'Katalog konnte nicht geladen werden' }); }
  }


  if (url.pathname === '/api/badge-images' && req.method === 'GET') {
    try { return json(res, 200, readBadgeImages()); }
    catch (error) { return json(res, 500, { error: error.message || 'Badge-Bilder konnten nicht geladen werden' }); }
  }

  if (url.pathname === '/api/badge-images' && req.method === 'DELETE') {
    try {
      const rows = db.prepare('SELECT badge_key, filename, mime, updated_at FROM badge_images').all();
      rows.forEach(row => backupBadgeImage(row.badge_key, row));
      db.prepare('DELETE FROM badge_images').run();
      rows.forEach(removeBadgeImageFile);
      return json(res, 200, { ok: true, reset: rows.length, updatedAt: nowIso() });
    } catch (error) { return json(res, 500, { error: error.message || 'Badge-Bilder konnten nicht zurückgesetzt werden' }); }
  }

  const badgeImageMatch = url.pathname.match(/^\/api\/badge-images\/([^/]+)$/);
  if (badgeImageMatch) {
    const key = safeBadgeKey(decodeURIComponent(badgeImageMatch[1]));
    if (!key) return json(res, 400, { error: 'Unbekanntes Badge' });
    const existing = db.prepare('SELECT badge_key, filename, mime, updated_at FROM badge_images WHERE badge_key = ?').get(key);

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const image = parseBadgeImageData(body.imageData);
        if (existing) backupBadgeImage(key, existing);
        const filename = `${key}.${badgeImageExtension(image.mime)}`;
        const target = path.join(BADGE_IMAGE_DIR, filename);
        const temp = `${target}.${process.pid}.tmp`;
        fs.writeFileSync(temp, image.bytes);
        fs.renameSync(temp, target);
        if (existing && existing.filename !== filename) removeBadgeImageFile(existing);
        const updatedAt = nowIso();
        db.prepare(`
          INSERT INTO badge_images(badge_key, filename, mime, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(badge_key) DO UPDATE SET filename = excluded.filename, mime = excluded.mime, updated_at = excluded.updated_at
        `).run(key, filename, image.mime, updatedAt);
        return json(res, 200, { ok: true, key, imageData: `data:${image.mime};base64,${image.bytes.toString('base64')}`, updatedAt });
      } catch (error) { return json(res, 400, { error: error.message || 'Badge-Bild konnte nicht gespeichert werden' }); }
    }

    if (req.method === 'DELETE') {
      if (!existing) return json(res, 200, { ok: true, key, removed: false, updatedAt: nowIso() });
      try {
        const backup = backupBadgeImage(key, existing);
        db.prepare('DELETE FROM badge_images WHERE badge_key = ?').run(key);
        removeBadgeImageFile(existing);
        return json(res, 200, { ok: true, key, removed: true, backup, updatedAt: nowIso() });
      } catch (error) { return json(res, 500, { error: error.message || 'Badge-Bild konnte nicht zurückgesetzt werden' }); }
    }

    return json(res, 405, { error: 'Methode nicht erlaubt' });
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
        db.prepare('DELETE FROM datasets').run();
        db.prepare('DELETE FROM profiles').run();
        db.prepare('DELETE FROM badge_images').run();
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      cleanupOrphanImages();
      for (const name of fs.readdirSync(BADGE_IMAGE_DIR)) { try { fs.unlinkSync(path.join(BADGE_IMAGE_DIR, name)); } catch {} }
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
