(() => {
  'use strict';

  const APP_VERSION = '2.4.3';
  const STORAGE_KEY = 'yatzy-duell-v2';
  const AREA_STORAGE_PREFIX = 'yatzy-duell-area-v1:';
  const DEVICE_KEY = 'yatzy-duell-device-v1';
  const BONUS_LIMIT = 63;
  const BONUS_POINTS = 25;
  const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)', 'var(--p6)'];

  const upperCategories = [
    { id: 'ones', label: 'Einer', face: '⚀', quick: [1,2,3,4,5] },
    { id: 'twos', label: 'Zweier', face: '⚁', quick: [2,4,6,8,10] },
    { id: 'threes', label: 'Dreier', face: '⚂', quick: [3,6,9,12,15] },
    { id: 'fours', label: 'Vierer', face: '⚃', quick: [4,8,12,16,20] },
    { id: 'fives', label: 'Fünfer', face: '⚄', quick: [5,10,15,20,25] },
    { id: 'sixes', label: 'Sechser', face: '⚅', quick: [6,12,18,24,30] }
  ];
  const lowerCategories = [
    { id: 'onePair', label: '1 Paar', quick: [2,4,6,8,10,12] },
    { id: 'twoPairs', label: '2 Paar', quick: [6,8,10,12,14,16,18,20,22] },
    { id: 'threeKind', label: 'Drei Gleiche', quick: [3,6,9,12,15,18] },
    { id: 'fourKind', label: 'Vier Gleiche', quick: [4,8,12,16,20,24] },
    { id: 'smallStraight', label: 'Kleine Strasse', quick: [15] },
    { id: 'largeStraight', label: 'Grosse Strasse', quick: [20] },
    { id: 'fullHouse', label: 'Volles Haus', quick: [7,8,9,11,12,13,14,15,16,17,18,19,20,21,22,23,24,26,27,28] },
    { id: 'chance', label: 'Chance', quick: Array.from({length:26}, (_,i) => i + 5) },
    { id: 'yatzy', label: 'YATZY', quick: [50] }
  ];
  const allCategories = [...upperCategories, ...lowerCategories];
  const categoryMap = Object.fromEntries(allCategories.map(category => [category.id, category]));

  const DIE_FACE_ICONS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const ACHIEVEMENT_LEVELS = [
    {key: 'bronze', label: 'Bronze', threshold: 1},
    {key: 'silver', label: 'Silber', threshold: 10},
    {key: 'gold', label: 'Gold', threshold: 25},
    {key: 'platinum', label: 'Platin', threshold: 100}
  ];
  const TIERED_ACHIEVEMENTS = [
    {key: 'games', icon: '🎲', title: 'Spiele gespielt', description: 'Abgeschlossene Partien mit diesem Spielerprofil.'},
    {key: 'wins', icon: '🏆', title: 'Siege', description: 'Allein gewonnene Partien.'},
    {key: 'yatzys', icon: '🎯', title: 'Yatzys', description: 'Alle erzielten Yatzys insgesamt.'},
    {key: 'bonus', icon: '✨', title: 'Bonus geschafft', description: 'Die obere Hälfte mit Bonus abgeschlossen.'},
    {key: 'noStrike', icon: '🧼', title: 'Nichts gestrichen', description: 'Eine Partie ohne Null in einer Kategorie.'},
    {key: 'fullHouse', icon: '🏠', title: 'Volles Haus', description: 'Volles Haus mit Punkten eingetragen.'},
    {key: 'smallStraight', icon: '↗️', title: 'Kleine Strasse', description: 'Kleine Strasse erfolgreich gewertet.'},
    {key: 'largeStraight', icon: '⬆️', title: 'Grosse Strasse', description: 'Grosse Strasse erfolgreich gewertet.'},
    {key: 'yatzy1', icon: '⚀', title: 'Einser-Yatzy', description: 'Yatzy mit fünf Einsern.'},
    {key: 'yatzy2', icon: '⚁', title: 'Zweier-Yatzy', description: 'Yatzy mit fünf Zweiern.'},
    {key: 'yatzy3', icon: '⚂', title: 'Dreier-Yatzy', description: 'Yatzy mit fünf Dreiern.'},
    {key: 'yatzy4', icon: '⚃', title: 'Vierer-Yatzy', description: 'Yatzy mit fünf Vierern.'},
    {key: 'yatzy5', icon: '⚄', title: 'Fünfer-Yatzy', description: 'Yatzy mit fünf Fünfern.'},
    {key: 'yatzy6', icon: '⚅', title: 'Sechser-Yatzy', description: 'Yatzy mit fünf Sechsern.'}
  ];

  const BADGE_IMAGES = {
    games: './badges/games.png',
    wins: './badges/wins.png',
    yatzys: './badges/yatzys.png',
    bonus: './badges/bonus.png',
    noStrike: './badges/no-strike.png',
    fullHouse: './badges/full-house.png',
    smallStraight: './badges/small-straight.png',
    largeStraight: './badges/large-straight.png',
    yatzy1: './badges/yatzy-1.png',
    yatzy2: './badges/yatzy-2.png',
    yatzy3: './badges/yatzy-3.png',
    yatzy4: './badges/yatzy-4.png',
    yatzy5: './badges/yatzy-5.png',
    yatzy6: './badges/yatzy-6.png',
    rainbow: './badges/rainbow.png'
  };


  let serverBadgeImages = {};
  let pendingBadgeImageKey = '';
  let badgeCropState = null;
  let badgeCropReturnToManager = false;
  const badgeCropPointers = new Map();
  let badgeCropGesture = null;
  const BADGE_CROP_SIZE = 640;
  function badgeImageFor(key) { return serverBadgeImages[key] || BADGE_IMAGES[key] || BADGE_IMAGES.games; }
  function badgeDefinitions() { return [...TIERED_ACHIEVEMENTS.map(item => ({...item, legendary:false})), {key:'rainbow', icon:'🌈', title:'Regenbogen-Yatzy', description:'Jede Yatzy-Augenzahl von Einser bis Sechser mindestens einmal sammeln.', legendary:true}]; }


  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const nowId = prefix => `${prefix || 'id'}-${Date.now()}-${cryptoRandom(10)}`;
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const timeValue = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  const scoreValue = value => {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.max(0, Math.min(999, number)) : 0;
  };
  const safeName = (value, fallback = 'Spieler') => String(value || '').trim().slice(0, 32) || fallback;
  const safeText = (value, max = 500) => String(value || '').trim().slice(0, max);
  const escapeHtml = value => String(value ?? '').replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));

  function cryptoRandom(length = 12) {
    const bytes = new Uint8Array(length);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function profileId() { return `profile-${cryptoRandom(16)}`; }
  function defaultProfileNames() { return ['Spieler 1', 'Spieler 2', 'Spieler 3']; }
  function makeProfile(name, stamp = nowIso(), id = profileId()) {
    return { id, name: safeName(name), archived: false, createdAt: stamp, updatedAt: stamp };
  }
  function normalisePlayerCount(value) {
    const count = Number.parseInt(value, 10);
    return Number.isFinite(count) ? Math.max(2, Math.min(6, count)) : 2;
  }
  function emptyScores(count) { return Array.from({length: count}, () => ({})); }
  function emptyYatzyFaces(count) { return Array.from({length: count}, () => null); }

  function totalsFor(scores) {
    const upper = upperCategories.reduce((sum, category) => sum + (hasOwn(scores, category.id) ? scoreValue(scores[category.id]) : 0), 0);
    const bonus = upper >= BONUS_LIMIT ? BONUS_POINTS : 0;
    const lower = lowerCategories.reduce((sum, category) => sum + (hasOwn(scores, category.id) ? scoreValue(scores[category.id]) : 0), 0);
    const filled = allCategories.reduce((sum, category) => sum + (hasOwn(scores, category.id) ? 1 : 0), 0);
    return { upper, bonus, lower, total: upper + bonus + lower, filled };
  }

  function winnersFromTotals(totals) {
    if (!totals.length) return [];
    const maximum = Math.max(...totals.map(total => total.total));
    return totals.map((total, index) => total.total === maximum ? index : -1).filter(index => index >= 0);
  }

  function makeNewState() {
    const stamp = nowIso();
    const profiles = defaultProfileNames().map(name => makeProfile(name, stamp));
    return {
      version: 7,
      areaCode: '',
      updatedAt: stamp,
      profiles,
      settings: {
        selectedProfileIds: profiles.slice(0, 2).map(profile => profile.id),
        playerCount: 2,
        nextStarter: 0,
        activeColumnMode: 'auto',
        keepScreenAwake: true,
        updatedAt: stamp
      },
      current: {
        id: nowId('game'),
        startedAt: stamp,
        updatedAt: stamp,
        starter: 0,
        playerIds: profiles.slice(0, 2).map(profile => profile.id),
        players: profiles.slice(0, 2).map(profile => profile.name),
        title: '',
        note: '',
        imageData: '',
        yatzyFaces: emptyYatzyFaces(2),
        scores: emptyScores(2),
        completed: false,
        historyId: null
      },
      history: [],
      undo: []
    };
  }

  function areaStorageKey(code) {
    return `${AREA_STORAGE_PREFIX}${encodeURIComponent(String(code || '').trim())}`;
  }

  function saveAreaCache(areaState, code = areaState?.areaCode) {
    const clean = String(code || '').trim();
    if (!isValidSyncCode(clean) || !areaState || typeof areaState !== 'object') return false;
    const cached = clone(areaState);
    cached.areaCode = clean;
    localStorage.setItem(areaStorageKey(clean), JSON.stringify(cached));
    return true;
  }

  function loadAreaCache(code) {
    const clean = String(code || '').trim();
    if (!isValidSyncCode(clean)) return null;
    try {
      const raw = JSON.parse(localStorage.getItem(areaStorageKey(clean)));
      if (!raw || typeof raw !== 'object') return null;
      const cached = normalizeState(raw);
      cached.areaCode = clean;
      return cached;
    } catch { return null; }
  }

  function makeEmptyAreaState(code) {
    const clean = String(code || '').trim();
    const stamp = nowIso();
    const sourceSettings = state?.settings || {};
    let profiles = mergeProfiles(state?.profiles || [], deviceSettings?.serverCatalog?.profiles || []);
    const requestedCount = normalisePlayerCount(sourceSettings.playerCount || 2);
    while (profiles.length < Math.max(3, requestedCount)) profiles.push(makeProfile(`Spieler ${profiles.length + 1}`, stamp));

    const available = profiles.filter(profile => !profile.archived);
    const selectable = available.length >= 2 ? available : profiles;
    const selectedProfileIds = [];
    for (const id of sourceSettings.selectedProfileIds || []) {
      if (selectable.some(profile => profile.id === id) && !selectedProfileIds.includes(id)) selectedProfileIds.push(id);
    }
    for (const profile of selectable) {
      if (selectedProfileIds.length >= requestedCount) break;
      if (!selectedProfileIds.includes(profile.id)) selectedProfileIds.push(profile.id);
    }
    const playerIds = selectedProfileIds.slice(0, requestedCount);
    const players = playerIds.map((id, index) => profiles.find(profile => profile.id === id)?.name || `Spieler ${index + 1}`);

    return normalizeState({
      version: 7,
      areaCode: clean,
      updatedAt: stamp,
      profiles,
      settings: {
        selectedProfileIds: playerIds,
        playerCount: requestedCount,
        nextStarter: 0,
        activeColumnMode: sourceSettings.activeColumnMode || 'auto',
        keepScreenAwake: sourceSettings.keepScreenAwake !== false,
        updatedAt: stamp
      },
      current: {
        id: nowId('game'),
        startedAt: stamp,
        updatedAt: stamp,
        starter: 0,
        playerIds,
        players,
        title: '',
        note: '',
        imageData: '',
        imageRef: '',
        imageMime: '',
        yatzyFaces: emptyYatzyFaces(requestedCount),
        scores: emptyScores(requestedCount),
        completed: false,
        historyId: null
      },
      history: [],
      undo: []
    });
  }

  function normaliseProfile(raw, fallbackName, stamp = nowIso()) {
    if (!raw || typeof raw !== 'object') return makeProfile(fallbackName, stamp);
    return {
      id: String(raw.id || profileId()),
      name: safeName(raw.name, fallbackName),
      archived: Boolean(raw.archived),
      createdAt: raw.createdAt || stamp,
      updatedAt: raw.updatedAt || raw.createdAt || stamp
    };
  }

  function ensureProfileForName(profiles, name, stamp = nowIso()) {
    const clean = safeName(name);
    const existing = profiles.find(profile => profile.name.toLocaleLowerCase('de-CH') === clean.toLocaleLowerCase('de-CH'));
    if (existing) return existing.id;
    const created = makeProfile(clean, stamp);
    profiles.push(created);
    return created.id;
  }

  function normaliseRecord(record, profiles) {
    if (!record || typeof record !== 'object') return null;
    const count = normalisePlayerCount(record.playerIds?.length || record.players?.length || record.scores?.length || 2);
    const rawNames = Array.from({length: count}, (_, index) => safeName(record.players?.[index], `Spieler ${index + 1}`));
    const playerIds = Array.from({length: count}, (_, index) => {
      const candidate = String(record.playerIds?.[index] || '');
      if (candidate && profiles.some(profile => profile.id === candidate)) return candidate;
      return ensureProfileForName(profiles, rawNames[index], record.finishedAt || record.startedAt || nowIso());
    });
    const players = playerIds.map((id, index) => profiles.find(profile => profile.id === id)?.name || rawNames[index]);
    const scores = Array.from({length: count}, (_, index) => record.scores?.[index] && typeof record.scores[index] === 'object' ? record.scores[index] : {});
    const totals = scores.map(totalsFor);
    let winners = Array.isArray(record.winners) ? record.winners.map(Number).filter(index => index >= 0 && index < count) : [];
    if (!winners.length && Number.isInteger(record.winner) && record.winner >= 0 && record.winner < count) winners = [record.winner];
    if (!winners.length) winners = winnersFromTotals(totals);
    winners = [...new Set(winners)];
    const sorted = totals.map(total => total.total).sort((a, b) => b - a);
    return {
      id: String(record.id || nowId('game')),
      startedAt: record.startedAt || record.finishedAt || nowIso(),
      finishedAt: record.finishedAt || nowIso(),
      starter: Math.max(0, Math.min(count - 1, Number(record.starter) || 0)),
      playerIds,
      players,
      title: safeText(record.title, 60),
      note: safeText(record.note, 500),
      imageData: typeof record.imageData === 'string' ? record.imageData : '',
      imageRef: typeof record.imageRef === 'string' ? record.imageRef : '',
      imageMime: typeof record.imageMime === 'string' ? record.imageMime : '',
      yatzyFaces: Array.from({length: count}, (_, index) => {
        const face = Number(record.yatzyFaces?.[index] || 0);
        return face >= 1 && face <= 6 && Number(scores[index]?.yatzy || 0) > 0 ? face : null;
      }),
      scores,
      totals,
      winners,
      winner: winners.length === 1 ? winners[0] : null,
      margin: winners.length === 1 ? Math.max(0, sorted[0] - (sorted[1] ?? 0)) : 0,
      bonusPoints: BONUS_POINTS,
      bonusLimit: BONUS_LIMIT
    };
  }

  function normalizeState(raw) {
    const fallback = makeNewState();
    if (!raw || typeof raw !== 'object') return fallback;
    const stamp = raw.updatedAt || nowIso();
    const profiles = [];
    if (Array.isArray(raw.profiles)) {
      raw.profiles.forEach((profile, index) => profiles.push(normaliseProfile(profile, `Spieler ${index + 1}`, stamp)));
    }
    const legacyNames = [
      ...(Array.isArray(raw.settings?.players) ? raw.settings.players : []),
      ...(Array.isArray(raw.current?.players) ? raw.current.players : []),
      ...(Array.isArray(raw.history) ? raw.history.flatMap(record => Array.isArray(record?.players) ? record.players : []) : [])
    ];
    legacyNames.forEach(name => ensureProfileForName(profiles, name, stamp));
    if (!profiles.length) fallback.profiles.forEach(profile => profiles.push(profile));
    while (profiles.length < 3) profiles.push(makeProfile(`Spieler ${profiles.length + 1}`, stamp));

    const history = Array.isArray(raw.history) ? raw.history.map(record => normaliseRecord(record, profiles)).filter(Boolean) : [];
    const currentCount = normalisePlayerCount(raw.current?.playerIds?.length || raw.current?.players?.length || raw.settings?.playerCount || 2);
    const currentNames = Array.from({length: currentCount}, (_, index) => safeName(raw.current?.players?.[index], `Spieler ${index + 1}`));
    const currentPlayerIds = Array.from({length: currentCount}, (_, index) => {
      const candidate = String(raw.current?.playerIds?.[index] || '');
      if (candidate && profiles.some(profile => profile.id === candidate)) return candidate;
      return ensureProfileForName(profiles, currentNames[index], raw.current?.startedAt || stamp);
    });
    const selectedFromRaw = Array.isArray(raw.settings?.selectedProfileIds) ? raw.settings.selectedProfileIds.map(String) : [];
    let selectedProfileIds = selectedFromRaw.filter((id, index, list) => profiles.some(profile => profile.id === id) && list.indexOf(id) === index);
    if (selectedProfileIds.length < 2) selectedProfileIds = [...currentPlayerIds];
    for (const profile of profiles) if (selectedProfileIds.length < 6 && !selectedProfileIds.includes(profile.id)) selectedProfileIds.push(profile.id);
    const settingsCount = normalisePlayerCount(raw.settings?.playerCount || selectedProfileIds.length || currentCount);

    return {
      version: 7,
      areaCode: isValidSyncCode(raw.areaCode) ? String(raw.areaCode).trim() : '',
      updatedAt: stamp,
      profiles,
      settings: {
        selectedProfileIds: selectedProfileIds.slice(0, 6),
        playerCount: settingsCount,
        nextStarter: Math.max(0, Math.min(settingsCount - 1, Number(raw.settings?.nextStarter) || 0)),
        activeColumnMode: ['auto', 'always', 'off'].includes(raw.settings?.activeColumnMode)
          ? raw.settings.activeColumnMode
          : raw.settings?.highlightCurrentPlayer === true ? 'always' : raw.settings?.highlightCurrentPlayer === false ? 'off' : 'auto',
        keepScreenAwake: raw.settings?.keepScreenAwake !== false,
        updatedAt: raw.settings?.updatedAt || stamp
      },
      current: {
        id: String(raw.current?.id || nowId('game')),
        startedAt: raw.current?.startedAt || nowIso(),
        updatedAt: raw.current?.updatedAt || stamp,
        starter: Math.max(0, Math.min(currentCount - 1, Number(raw.current?.starter) || 0)),
        playerIds: currentPlayerIds,
        players: currentPlayerIds.map((id, index) => profiles.find(profile => profile.id === id)?.name || currentNames[index]),
        title: safeText(raw.current?.title, 60),
        note: safeText(raw.current?.note, 500),
        imageData: typeof raw.current?.imageData === 'string' ? raw.current.imageData : '',
        imageRef: typeof raw.current?.imageRef === 'string' ? raw.current.imageRef : '',
        imageMime: typeof raw.current?.imageMime === 'string' ? raw.current.imageMime : '',
        yatzyFaces: Array.from({length: currentCount}, (_, index) => {
          const face = Number(raw.current?.yatzyFaces?.[index] || 0);
          return face >= 1 && face <= 6 && Number(raw.current?.scores?.[index]?.yatzy || 0) > 0 ? face : null;
        }),
        scores: Array.from({length: currentCount}, (_, index) => raw.current?.scores?.[index] && typeof raw.current.scores[index] === 'object' ? raw.current.scores[index] : {}),
        completed: Boolean(raw.current?.completed),
        historyId: raw.current?.historyId || null
      },
      history,
      undo: Array.isArray(raw.undo) ? raw.undo.slice(-30) : []
    };
  }

  function defaultDeviceSettings() {
    return {
      storageMode: 'local', syncUrl: '', syncCode: '', syncCodes: [],
      cloudflareClientId: '', cloudflareClientSecret: '', autoSync: true,
      gameMode: false, lastSyncAt: null, lastSyncByCode: {},
      serverCatalog: null, catalogFetchedAt: null, statsProfileId: '', badgeProfileId: '', badgeFilter: 'all',
      statsView: 'area', statsAreaRange: 'all'
    };
  }

  function isValidSyncCode(code) { return /^[A-Za-z0-9_-]{3,40}$/.test(String(code || '').trim()); }
  function normaliseSyncCodes(values) {
    const result = [];
    (Array.isArray(values) ? values : []).forEach(value => {
      const code = String(value || '').trim();
      if (isValidSyncCode(code) && !result.includes(code)) result.push(code);
    });
    return result;
  }

  function loadDeviceSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(DEVICE_KEY));
      const settings = {...defaultDeviceSettings(), ...(raw && typeof raw === 'object' ? raw : {})};
      settings.syncCodes = normaliseSyncCodes([...(settings.syncCodes || []), settings.syncCode, ...(settings.serverCatalog?.codes || [])]);
      if (!settings.syncCodes.includes(settings.syncCode)) settings.syncCode = settings.syncCodes[0] || '';
      if (!settings.lastSyncByCode || typeof settings.lastSyncByCode !== 'object' || Array.isArray(settings.lastSyncByCode)) settings.lastSyncByCode = {};
      settings.lastSyncAt = settings.syncCode ? settings.lastSyncByCode[settings.syncCode] || settings.lastSyncAt || null : null;
      settings.statsView = settings.statsView === 'profile' ? 'profile' : 'area';
      settings.statsAreaRange = ['all', '25', '10'].includes(String(settings.statsAreaRange)) ? String(settings.statsAreaRange) : 'all';
      settings.badgeFilter = ['all', 'unlocked', 'locked'].includes(String(settings.badgeFilter)) ? String(settings.badgeFilter) : 'all';
      return settings;
    } catch { return defaultDeviceSettings(); }
  }

  function loadState() {
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return makeNewState(); }
  }

  let state = loadState();
  let deviceSettings = loadDeviceSettings();
  if (isValidSyncCode(state.areaCode)) saveAreaCache(state, state.areaCode);
  if (deviceSettings.storageMode === 'synology' && isValidSyncCode(deviceSettings.syncCode)) {
    if (!state.areaCode) {
      state.areaCode = deviceSettings.syncCode;
    } else if (state.areaCode !== deviceSettings.syncCode) {
      state = loadAreaCache(deviceSettings.syncCode) || makeEmptyAreaState(deviceSettings.syncCode);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveAreaCache(state, deviceSettings.syncCode);
  }
  let activeEdit = null;
  let activeHistoryId = null;
  let confirmAction = null;
  let toastTimer = null;
  let wakeLockSentinel = null;
  let wakeLockPending = false;
  let syncTimer = null;
  let syncInProgress = false;
  let catalogInProgress = false;
  let pendingGameImage = '';
  let pendingSummaryImage = '';
  let activeSummaryId = null;
  let yatzyFaceResolver = null;
  let achievementQueue = [];
  let achievementTimer = null;
  let achievementQueueDone = null;
  let pendingImport = null;
  let lastAutoScrolledPlayer = '';

  function saveDeviceSettings() { localStorage.setItem(DEVICE_KEY, JSON.stringify(deviceSettings)); }
  function saveState({queueSync = true} = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (isValidSyncCode(state.areaCode)) saveAreaCache(state, state.areaCode);
    if (queueSync && deviceSettings.storageMode === 'synology' && deviceSettings.autoSync) scheduleSync();
  }
  function markChanged({settings = false} = {}) {
    const stamp = nowIso();
    state.updatedAt = stamp;
    state.current.updatedAt = stamp;
    if (settings) state.settings.updatedAt = stamp;
    saveState();
  }

  function profileById(id) { return state.profiles.find(profile => profile.id === id) || null; }
  function profileName(id, fallback = 'Spieler') { return profileById(id)?.name || fallback; }
  function activeProfiles() { return state.profiles.filter(profile => !profile.archived); }
  function profileInitials(name) {
    return safeName(name).split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('de-CH') || '').join('') || '?';
  }
  function activeCount() { return state.current.playerIds.length; }

  function recordFromCurrent() {
    const totals = state.current.scores.map(totalsFor);
    const winners = winnersFromTotals(totals);
    const sorted = totals.map(total => total.total).sort((a, b) => b - a);
    return {
      id: state.current.id,
      startedAt: state.current.startedAt,
      finishedAt: nowIso(),
      starter: state.current.starter,
      playerIds: clone(state.current.playerIds),
      players: clone(state.current.players),
      title: state.current.title,
      note: state.current.note,
      imageData: state.current.imageData,
      imageRef: state.current.imageRef || '',
      imageMime: state.current.imageMime || '',
      yatzyFaces: clone(state.current.yatzyFaces || emptyYatzyFaces(state.current.players.length)),
      scores: clone(state.current.scores),
      totals,
      winners,
      winner: winners.length === 1 ? winners[0] : null,
      margin: winners.length === 1 ? Math.max(0, sorted[0] - (sorted[1] ?? 0)) : 0,
      bonusPoints: BONUS_POINTS,
      bonusLimit: BONUS_LIMIT
    };
  }

  function winnerLabel(record) {
    if (record.winners.length === 1) return `${record.players[record.winners[0]]} gewinnt`;
    if (record.winners.length === record.players.length) return 'Unentschieden';
    return `${record.winners.map(index => record.players[index]).join(' & ')} teilen den Sieg`;
  }
  function scoreLine(record) { return record.totals.map(total => total.total).join(' : '); }
  function currentPlayerIndex(totals = state.current.scores.map(totalsFor)) {
    if (state.current.completed || !totals.length) return -1;
    const filled = totals.reduce((sum, total) => sum + total.filled, 0);
    return (state.current.starter + filled) % totals.length;
  }

  function highlightCurrentPlayerEnabled(currentPlayer = currentPlayerIndex(), count = activeCount()) {
    const mode = state.settings.activeColumnMode || 'auto';
    return currentPlayer >= 0 && (mode === 'always' || (mode === 'auto' && count >= 5));
  }
  function activeColumnClass(index, currentPlayer) {
    return highlightCurrentPlayerEnabled(currentPlayer) && index === currentPlayer ? ' is-active-player' : '';
  }
  function scoreGridLayout(count, currentPlayer) {
    const highlight = highlightCurrentPlayerEnabled(currentPlayer, count);
    const desktop = window.matchMedia('(min-width: 900px)').matches;
    const tablet = window.matchMedia('(min-width: 600px)').matches;
    const categoryMin = desktop ? 144 : tablet ? (count <= 3 ? 124 : 112) : count <= 2 ? 112 : count === 3 ? 96 : count === 4 ? 92 : 104;
    const categoryFlex = desktop ? 1.5 : tablet ? 1.3 : count <= 2 ? 1.45 : count === 3 ? 1.2 : count === 4 ? 1.05 : 1;
    const playerMin = desktop ? (count <= 4 ? 82 : 76) : tablet ? (count <= 3 ? 72 : 66) : count <= 2 ? 68 : count === 3 ? 57 : count === 4 ? 54 : count === 5 ? 64 : 66;
    const activeFactor = desktop ? 1.1 : tablet ? 1.18 : 1.28;
    const activeFlex = desktop ? 1.12 : tablet ? 1.2 : 1.32;
    const columns = Array.from({length: count}, (_, index) => `minmax(${highlight && index === currentPlayer ? Math.round(playerMin * activeFactor) : playerMin}px, ${highlight && index === currentPlayer ? activeFlex : 1}fr)`);
    const minimum = desktop || (tablet && count <= 5) || count <= 4 ? '100%' : `${categoryMin + columns.reduce((sum, _, index) => sum + (highlight && index === currentPlayer ? Math.round(playerMin * activeFactor) : playerMin), 0)}px`;
    return {columns: `minmax(${categoryMin}px, ${categoryFlex}fr) ${columns.join(' ')}`, minimum, highlight};
  }
  function applyScorecardLayout(count, currentPlayer) {
    const scorecard = $('scorecard');
    const layout = scoreGridLayout(count, currentPlayer);
    scorecard.className = `scorecard players-${count}${count >= 5 ? ' players-many' : ''}${layout.highlight ? ' highlight-active' : ''}`;
    scorecard.style.setProperty('--score-columns', layout.columns);
    scorecard.style.setProperty('--scorecard-min-width', layout.minimum);
  }
  function scrollActivePlayerIntoView(currentPlayer, {force = false} = {}) {
    const scorecard = $('scorecard');
    if (!scorecard || !highlightCurrentPlayerEnabled(currentPlayer)) return;
    const key = `${state.current.id}:${currentPlayer}`;
    if (!force && lastAutoScrolledPlayer === key) return;
    lastAutoScrolledPlayer = key;
    requestAnimationFrame(() => {
      const target = scorecard.querySelector(`.player-header[data-player="${currentPlayer}"]`);
      if (!target || scorecard.scrollWidth <= scorecard.clientWidth + 2) return;
      const desired = target.offsetLeft + target.offsetWidth / 2 - scorecard.clientWidth / 2;
      const left = Math.max(0, Math.min(scorecard.scrollWidth - scorecard.clientWidth, desired));
      scorecard.scrollTo({left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    });
  }
  function renderGameModeBar(totals, currentPlayer) {
    const filled = totals.reduce((sum, total) => sum + total.filled, 0);
    const totalTurns = Math.max(1, activeCount() * allCategories.length);
    const nextTurn = Math.min(totalTurns, filled + 1);
    const activeName = currentPlayer >= 0 ? state.current.players[currentPlayer] : (state.current.completed ? 'Runde beendet' : 'Kein Spieler aktiv');
    $('gameModeActivePlayer').textContent = activeName;
    $('gameModeActivePlayer').title = activeName;
    $('gameModeProgress').textContent = state.current.completed ? `${totalTurns} von ${totalTurns} Einträgen` : `Zug ${nextTurn} von ${totalTurns}`;
  }

  function renderPlayerHeader(totals, currentPlayer) {
    const count = activeCount();
    applyScorecardLayout(count, currentPlayer);
    const categoryHead = '<div class="category-title"><div class="category-title-wrap"><span>Kategorie</span></div></div>';
    const players = state.current.players.map((name, index) => `<div class="player-header${activeColumnClass(index, currentPlayer)}" data-player="${index}"><span class="starter-dot">${state.current.starter === index ? 'START' : ''}</span><strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong><small>${totals[index].total} P.</small></div>`).join('');
    $('playerHeader').innerHTML = categoryHead + players;
  }

  function sectionRow(label, currentPlayer) { return `<div class="grid-row section-row"><div>${escapeHtml(label)}</div>${state.current.players.map((_, index) => `<div class="${activeColumnClass(index, currentPlayer).trim()}" data-player="${index}"></div>`).join('')}</div>`; }
  function scoreRow(category, currentPlayer) {
    const cells = state.current.players.map((_, player) => {
      const scoreObject = state.current.scores[player];
      const filled = hasOwn(scoreObject, category.id);
      const value = filled ? scoreObject[category.id] : '';
      const classes = ['score-button', filled ? 'is-filled' : 'is-open'];
      if (filled && Number(value) === 0) classes.push('is-zero');
      return `<div class="score-cell${activeColumnClass(player, currentPlayer)}" data-player="${player}"><button class="${classes.join(' ')}" type="button" data-player="${player}" data-category="${category.id}" ${state.current.completed || filled ? 'disabled' : ''} aria-label="${escapeHtml(state.current.players[player])}, ${escapeHtml(category.label)}${filled ? ', bereits eingetragen' : ''}">${filled ? value : '–'}</button></div>`;
    }).join('');
    const currentOpen = currentPlayer >= 0 && !hasOwn(state.current.scores[currentPlayer], category.id);
    return `<div class="grid-row"><div class="category-cell"><span class="category-label${currentOpen ? ' is-current-open' : ''}">${escapeHtml(category.label)}</span>${category.face ? `<span class="dice-face" aria-hidden="true">${category.face}</span>` : ''}</div>${cells}</div>`;
  }
  function calcRow(label, values, className, currentPlayer, {meta = '', shortLabel = ''} = {}) {
    const labelMarkup = `<span class="calc-label-stack"><span class="calc-label-main calc-label-long">${escapeHtml(label)}</span>${shortLabel ? `<span class="calc-label-main calc-label-short">${escapeHtml(shortLabel)}</span>` : ''}${meta ? `<small class="calc-label-meta">${escapeHtml(meta)}</small>` : ''}</span>`;
    return `<div class="grid-row ${className}"><div>${labelMarkup}</div>${values.map((value, index) => `<div class="calculated${activeColumnClass(index, currentPlayer)}" data-player="${index}">${value}</div>`).join('')}</div>`;
  }
  function renderScoreRows(totals, currentPlayer) {
    const rows = [sectionRow('Oberer Teil', currentPlayer)];
    upperCategories.forEach(category => rows.push(scoreRow(category, currentPlayer)));
    rows.push(calcRow('Summe oben', totals.map(total => total.upper), 'total-row', currentPlayer));
    rows.push(calcRow('Bonus', totals.map(total => total.bonus), 'bonus-row', currentPlayer, {meta: `${BONUS_POINTS} ab ${BONUS_LIMIT}`}));
    rows.push(sectionRow('Unterer Teil', currentPlayer));
    lowerCategories.forEach(category => rows.push(scoreRow(category, currentPlayer)));
    rows.push(calcRow('Gesamtsumme', totals.map(total => total.total), 'grand-row', currentPlayer, {shortLabel: 'Gesamt'}));
    $('scoreRows').innerHTML = rows.join('');
    $('scoreRows').querySelectorAll('.score-button').forEach(button => button.addEventListener('click', () => openScoreDialog(Number(button.dataset.player), button.dataset.category)));
  }
  function renderProgress(totals) {
    $('progressCard').innerHTML = state.current.players.map((name, index) => `<div class="progress-line" data-player="${index}"><span>${escapeHtml(name)}</span><strong>${totals[index].filled} / ${allCategories.length}</strong><div class="progress-track"><span style="width:${totals[index].filled / allCategories.length * 100}%;background:${PLAYER_COLOURS[index]}"></span></div></div>`).join('');
  }

  function renderGame() {
    const totals = state.current.scores.map(totalsFor);
    const currentPlayer = currentPlayerIndex(totals);
    renderGameModeBar(totals, currentPlayer);
    renderPlayerHeader(totals, currentPlayer);
    renderScoreRows(totals, currentPlayer);
    renderProgress(totals);
    scrollActivePlayerIntoView(currentPlayer);
    $('starterName').textContent = state.current.players[state.current.starter];
    $('leaderScore').textContent = totals.map(total => total.total).join(' : ');
    $('undoButton').disabled = state.undo.length === 0;
    $('reopenButton').textContent = 'Letzten Eintrag korrigieren';
    $('reopenButton').classList.toggle('hidden', !state.current.completed || state.undo.length === 0);
    $('manualSyncButton').classList.toggle('hidden', deviceSettings.storageMode !== 'synology');
    const allZero = totals.every(total => total.total === 0);
    const maximum = Math.max(...totals.map(total => total.total));
    const leaders = totals.map((total, index) => total.total === maximum ? index : -1).filter(index => index >= 0);
    if (state.current.completed) {
      const record = state.history.find(item => item.id === state.current.historyId) || recordFromCurrent();
      $('gameStatusLabel').textContent = state.current.title || 'Runde abgeschlossen';
      $('leaderName').textContent = winnerLabel(record);
    } else if (allZero) {
      $('gameStatusLabel').textContent = state.current.title || 'Aktueller Stand';
      $('leaderName').textContent = 'Noch offen';
    } else if (leaders.length > 1) {
      $('gameStatusLabel').textContent = state.current.title || 'Aktueller Stand';
      $('leaderName').textContent = leaders.length === activeCount() ? 'Gleichstand' : `${leaders.map(index => state.current.players[index]).join(' & ')} führen`;
    } else {
      $('gameStatusLabel').textContent = state.current.title || 'Aktueller Stand';
      $('leaderName').textContent = `${state.current.players[leaders[0]]} führt`;
    }
    $('storageNote').textContent = deviceSettings.storageMode === 'synology'
      ? 'Lokal gespeichert. Profile, Spiele, Notizen und Bilder werden nach Möglichkeit synchronisiert.'
      : deviceSettings.storageMode === 'file'
        ? 'Lokal gespeichert. Sicherungen lassen sich über die Dateien-App austauschen.'
        : 'Die aktuelle Partie, Historie, Bilder und Statistik werden automatisch auf diesem Gerät gespeichert.';
  }

  function openScoreDialog(player, categoryId) {
    if (state.current.completed) return;
    const category = categoryMap[categoryId];
    if (!category || player < 0 || player >= activeCount()) return;
    if (hasOwn(state.current.scores[player], categoryId)) { toast('Dieser Wert ist bereits eingetragen. Nutze Rückgängig für eine Korrektur.'); return; }
    activeEdit = {player, categoryId};
    $('scorePlayerLabel').textContent = state.current.players[player];
    $('scoreCategoryLabel').textContent = category.label;
    const current = state.current.scores[player];
    const existing = hasOwn(current, categoryId) ? Number(current[categoryId]) : null;
    const selected = existing !== null && existing > 0 && category.quick.includes(existing);
    $('scoreInput').value = selected ? String(existing) : '';
    $('scoreInput').textContent = existing === 0 ? 'Gestrichen' : selected ? String(existing) : 'Bitte auswählen';
    $('scoreInput').classList.toggle('is-empty', existing === null);
    $('quickValues').innerHTML = category.quick.map(value => `<button class="quick-value${selected && value === existing ? ' is-selected' : ''}" type="button" data-value="${value}">${value}</button>`).join('');
    $('saveScoreButton').disabled = !selected;
    $('quickValues').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      $('scoreInput').value = button.dataset.value;
      $('scoreInput').textContent = button.dataset.value;
      $('scoreInput').classList.remove('is-empty');
      $('saveScoreButton').disabled = false;
      $('quickValues').querySelectorAll('button').forEach(item => item.classList.toggle('is-selected', item === button));
    }));
    $('scoreDialog').showModal();
  }


  function pushUndo() {
    state.undo.push({scores: clone(state.current.scores), yatzyFaces: clone(state.current.yatzyFaces || emptyYatzyFaces(activeCount())), updatedAt: state.current.updatedAt});
    if (state.undo.length > 30) state.undo.shift();
  }
  function closeYatzyFaceDialog(face = null) {
    if ($('yatzyFaceDialog').open) $('yatzyFaceDialog').close();
    if (yatzyFaceResolver) {
      const resolve = yatzyFaceResolver;
      yatzyFaceResolver = null;
      resolve(face);
    }
  }
  function askYatzyFace(playerName) {
    $('yatzyFacePlayer').textContent = playerName || 'Spieler';
    return new Promise(resolve => {
      yatzyFaceResolver = resolve;
      $('yatzyFaceDialog').showModal();
    });
  }
  async function setScore(value, clear = false) {
    if (!activeEdit || state.current.completed) return;
    const {player, categoryId} = activeEdit;
    if (hasOwn(state.current.scores[player], categoryId)) { $('scoreDialog').close(); activeEdit = null; toast('Dieser Wert ist bereits eingetragen. Nutze Rückgängig für eine Korrektur.'); return; }
    let selectedFace = null;
    if (!clear && categoryId === 'yatzy' && scoreValue(value) > 0) {
      const existingFace = Number(state.current.yatzyFaces?.[player] || 0);
      selectedFace = existingFace >= 1 && existingFace <= 6 ? existingFace : await askYatzyFace(state.current.players[player]);
      if (!selectedFace) return;
    }
    pushUndo();
    if (!Array.isArray(state.current.yatzyFaces) || state.current.yatzyFaces.length !== activeCount()) state.current.yatzyFaces = emptyYatzyFaces(activeCount());
    const target = state.current.scores[player];
    if (clear) {
      delete target[categoryId];
      if (categoryId === 'yatzy') state.current.yatzyFaces[player] = null;
    } else {
      target[categoryId] = scoreValue(value);
      if (categoryId === 'yatzy') state.current.yatzyFaces[player] = scoreValue(value) > 0 ? selectedFace : null;
    }
    markChanged();
    $('scoreDialog').close();
    activeEdit = null;
    renderAll();
    maybeFinishGame();
  }
  function closeAchievementOverlay() {
    clearTimeout(achievementTimer);
    achievementTimer = null;
    $('achievementOverlay').hidden = true;
  }
  function finishAchievementQueue() {
    closeAchievementOverlay();
    const done = achievementQueueDone;
    achievementQueueDone = null;
    if (done) done();
  }
  function presentNextAchievement() {
    clearTimeout(achievementTimer);
    achievementTimer = null;
    const item = achievementQueue.shift();
    if (!item) { finishAchievementQueue(); return; }
    const popup = $('achievementPopup');
    popup.className = `achievement-popup level-${item.levelKey}`;
    $('achievementPopupKicker').textContent = item.legendary ? 'Legendärer Badge freigeschaltet' : `${item.levelLabel}-Badge freigeschaltet`;
    $('achievementPopupImage').src = badgeImageFor(item.key);
    $('achievementPopupImage').alt = item.title;
    $('achievementPopupTitle').textContent = item.title;
    $('achievementPopupPlayer').textContent = item.playerName;
    $('achievementPopupCopy').textContent = item.description;
    $('achievementPopupProgress').innerHTML = item.legendary ? '<strong>6 von 6</strong> Yatzy-Arten gesammelt' : `<strong>${item.count}</strong> erreicht · ${escapeHtml(item.levelLabel)}`;
    $('achievementOverlay').hidden = false;
    popup.animate([{opacity: .2, transform: 'translateY(12px) scale(.95)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.2,.82,.22,1)'});
    achievementTimer = setTimeout(presentNextAchievement, item.legendary ? 4200 : 3000);
  }
  function queueAchievements(items, onDone) {
    if (!items.length) { onDone?.(); return; }
    achievementQueue = [...items];
    achievementQueueDone = onDone || null;
    presentNextAchievement();
  }
  function maybeFinishGame() {
    if (state.current.completed) return;
    const totals = state.current.scores.map(totalsFor);
    if (totals.every(total => total.filled === allCategories.length)) {
      const beforeByProfile = new Map(state.current.playerIds.map(id => [id, achievementUnlocks(id)]));
      const record = recordFromCurrent();
      state.current.completed = true;
      state.current.historyId = record.id;
      state.current.updatedAt = record.finishedAt;
      state.history.unshift(record);
      const unlockedNow = state.current.playerIds.flatMap((id, index) => newAchievementUnlocks(beforeByProfile.get(id) || [], achievementUnlocks(id), state.current.players[index] || profileName(id)));
      state.updatedAt = record.finishedAt;
      saveState();
      renderAll();
      queueAchievements(unlockedNow, () => showSummary(record));
    }
  }
  function reopenCurrentGame() {
    if (!state.current.completed || !state.undo.length) return;
    undo();
  }

  function selectedPlayerCount() { return normalisePlayerCount(document.querySelector('input[name="playerCount"]:checked')?.value); }
  function selectedNewProfileIds(count = selectedPlayerCount()) {
    return Array.from({length: count}, (_, index) => $(`newProfile${index}`)?.value || '').filter(Boolean);
  }
  function renderNewGameProfileOptions() {
    const profiles = activeProfiles();
    const preferred = [...state.settings.selectedProfileIds];
    const chosen = new Set();
    for (let index = 0; index < 6; index += 1) {
      const select = $(`newProfile${index}`);
      if (!select) continue;
      const previous = select.value;
      const candidates = [previous, preferred[index], profiles[index]?.id, ...profiles.map(profile => profile.id)];
      const selected = candidates.find(id => id && profiles.some(profile => profile.id === id) && !chosen.has(id)) || '';
      select.innerHTML = `<option value="">Profil wählen</option>${profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`).join('')}`;
      select.value = selected;
      if (selected) chosen.add(selected);
    }
  }
  function refreshNewGameDialog() {
    const count = selectedPlayerCount();
    for (let index = 2; index < 6; index += 1) $(`newProfileWrap${index}`).classList.toggle('hidden', index >= count);
    const ids = selectedNewProfileIds(count);
    let proposed = Number(state.settings.nextStarter) || 0;
    if (proposed >= count) proposed = 0;
    $('starterChoices').style.gridTemplateColumns = `repeat(${count <= 3 ? count : 3}, 1fr)`;
    $('starterChoices').innerHTML = Array.from({length: count}, (_, index) => {
      const id = $(`newProfile${index}`)?.value || '';
      return `<label class="radio-card"><input type="radio" name="starter" value="${index}" ${index === proposed ? 'checked' : ''} ${id ? '' : 'disabled'}><span>${escapeHtml(id ? profileName(id, `Spieler ${index + 1}`) : 'Profil wählen')}</span></label>`;
    }).join('');
    $('startGameButton').disabled = ids.length !== count || new Set(ids).size !== count;
  }
  function openNewGameDialog() {
    renderNewGameProfileOptions();
    const count = normalisePlayerCount(state.settings.playerCount);
    document.querySelector(`input[name="playerCount"][value="${count}"]`).checked = true;
    $('newGameTitle').value = '';
    $('newGameNote').value = '';
    $('newGameImage').value = '';
    pendingGameImage = '';
    renderPendingImage();
    refreshNewGameDialog();
    $('newGameDialog').showModal();
  }
  function addProfile(name, {selectInNewGame = false} = {}) {
    const clean = safeName(name, '');
    if (!clean) return null;
    const duplicate = state.profiles.find(profile => !profile.archived && profile.name.toLocaleLowerCase('de-CH') === clean.toLocaleLowerCase('de-CH'));
    if (duplicate) { toast('Dieses Spielerprofil existiert bereits'); return duplicate; }
    const profile = makeProfile(clean);
    state.profiles.push(profile);
    state.updatedAt = profile.updatedAt;
    saveState();
    renderAll();
    if (selectInNewGame) {
      renderNewGameProfileOptions();
      const count = selectedPlayerCount();
      const currentIds = Array.from({length: count}, (_, index) => $(`newProfile${index}`)?.value || '');
      const target = currentIds.findIndex(id => !id) >= 0
        ? currentIds.findIndex(id => !id)
        : currentIds.findIndex((id, index) => id && currentIds.indexOf(id) !== index);
      $(`newProfile${target >= 0 ? target : count - 1}`).value = profile.id;
      refreshNewGameDialog();
    }
    return profile;
  }
  function promptAddProfile(selectInNewGame = false) {
    const name = window.prompt('Name des neuen Spielerprofils');
    if (name === null) return;
    const profile = addProfile(name, {selectInNewGame});
    if (profile) toast(`Profil «${profile.name}» angelegt`);
  }
  function editProfile(id) {
    const profile = profileById(id);
    if (!profile) return;
    const name = window.prompt('Spielerprofil umbenennen', profile.name);
    if (name === null) return;
    const clean = safeName(name, '');
    if (!clean) { toast('Bitte einen Namen eingeben'); return; }
    if (state.profiles.some(item => item.id !== id && !item.archived && item.name.toLocaleLowerCase('de-CH') === clean.toLocaleLowerCase('de-CH'))) { toast('Dieser Name wird bereits verwendet'); return; }
    profile.name = clean;
    profile.updatedAt = nowIso();
    state.current.players = state.current.playerIds.map((profileIdValue, index) => profileIdValue === id ? clean : state.current.players[index]);
    state.updatedAt = profile.updatedAt;
    saveState();
    renderAll();
    toast('Profil umbenannt');
  }
  function profileUsedLocally(id) {
    if (state.current?.playerIds?.includes(id)) return true;
    return state.history.some(record => record.playerIds?.includes(id));
  }
  function canUseServerManagement() {
    if (deviceSettings.storageMode !== 'synology') return false;
    const hasId = Boolean(deviceSettings.cloudflareClientId);
    const hasSecret = Boolean(deviceSettings.cloudflareClientSecret);
    if (hasId !== hasSecret) return false;
    try { new URL(syncBase()); return true; } catch { return false; }
  }
  async function serverManagementRequest(pathname, {method = 'GET', body = null} = {}) {
    const response = await fetch(`${syncBase()}${pathname}`, {
      method,
      headers: {'Accept': 'application/json', ...(body ? {'Content-Type': 'application/json'} : {}), ...cloudflareHeaders()},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }
  async function setProfileArchived(id, archived) {
    const profile = profileById(id);
    if (!profile) return false;
    if (archived && activeProfiles().length <= 2) { toast('Mindestens zwei aktive Profile müssen bleiben'); return false; }
    if (canUseServerManagement()) {
      await serverManagementRequest(`/api/profiles/${encodeURIComponent(id)}/${archived ? 'archive' : 'restore'}`, {method: 'POST'});
    }
    profile.archived = archived;
    profile.updatedAt = nowIso();
    if (archived) state.settings.selectedProfileIds = state.settings.selectedProfileIds.filter(profileIdValue => profileIdValue !== id);
    state.updatedAt = profile.updatedAt;
    saveState({queueSync: false});
    if (canUseServerManagement()) await refreshServerCatalog({silent: true});
    renderAll();
    toast(archived ? 'Profil ausgeblendet' : 'Profil wieder eingeblendet');
    return true;
  }
  function archiveProfile(id) {
    const profile = profileById(id);
    if (!profile) return;
    if (activeProfiles().length <= 2) { toast('Mindestens zwei aktive Profile müssen bleiben'); return; }
    showConfirm('Spielerprofil ausblenden?', `«${profile.name}» bleibt in alten Spielen und Statistiken erhalten, wird aber bei neuen Runden nicht mehr angeboten.${canUseServerManagement() ? ' Die Änderung gilt auf dem ganzen Server.' : ''}`, 'Ausblenden', async () => {
      try { await setProfileArchived(id, true); }
      catch (error) { toast(error.message || 'Profil konnte nicht ausgeblendet werden'); }
    }, '👤');
  }
  async function restoreProfile(id) {
    try { await setProfileArchived(id, false); }
    catch (error) { toast(error.message || 'Profil konnte nicht eingeblendet werden'); }
  }
  function removeProfileLocally(id) {
    const profile = profileById(id);
    if (!profile || profileUsedLocally(id)) return false;
    if (!profile.archived && activeProfiles().length <= 2) return false;
    state.profiles = state.profiles.filter(item => item.id !== id);
    state.settings.selectedProfileIds = state.settings.selectedProfileIds.filter(profileIdValue => profileIdValue !== id);
    if (deviceSettings.statsProfileId === id) deviceSettings.statsProfileId = '';
    state.updatedAt = nowIso();
    saveState({queueSync: false});
    saveDeviceSettings();
    return true;
  }
  function deleteProfile(id) {
    const profile = profileById(id);
    if (!profile) return;
    if (profileUsedLocally(id)) {
      showConfirm('Profil wird noch verwendet', `«${profile.name}» gehört zu bestehenden Spielen und kann deshalb nicht gelöscht werden. Du kannst es stattdessen ausblenden.`, 'Ausblenden', async () => {
        try { await setProfileArchived(id, true); }
        catch (error) { toast(error.message || 'Profil konnte nicht ausgeblendet werden'); }
      }, '👤');
      return;
    }
    if (!profile.archived && activeProfiles().length <= 2) { toast('Mindestens zwei aktive Profile müssen bleiben'); return; }
    showConfirm('Spielerprofil löschen?', `«${profile.name}» wird dauerhaft entfernt. Auf dem Server ist das nur möglich, wenn die ID in keinem Spielbereich mehr verwendet wird.`, 'Profil löschen', async () => {
      try {
        if (canUseServerManagement()) {
          try {
            await serverManagementRequest(`/api/profiles/${encodeURIComponent(id)}`, {method: 'DELETE'});
          } catch (error) {
            if (error.status === 409) {
              showConfirm('Profil wird auf dem Server verwendet', `«${profile.name}» kommt noch in ${error.payload?.areas?.length || 1} Spielbereich(en) vor und kann nicht gelöscht werden. Stattdessen serverweit ausblenden?`, 'Ausblenden', async () => {
                try { await setProfileArchived(id, true); }
                catch (archiveError) { toast(archiveError.message || 'Profil konnte nicht ausgeblendet werden'); }
              }, '👤');
              return;
            }
            if (error.status !== 404) throw error;
          }
        }
        if (!removeProfileLocally(id)) throw new Error('Profil konnte lokal nicht gelöscht werden');
        if (canUseServerManagement()) await refreshServerCatalog({silent: true});
        renderAll();
        toast('Spielerprofil gelöscht');
      } catch (error) { toast(error.message || 'Spielerprofil konnte nicht gelöscht werden'); }
    }, '🗑️');
  }

  async function startNewGame() {
    const count = selectedPlayerCount();
    const playerIds = selectedNewProfileIds(count);
    if (playerIds.length !== count || new Set(playerIds).size !== count) { toast('Bitte unterschiedliche Spielerprofile auswählen'); return; }
    if (activeProfiles().length < count) { toast(`Für ${count} Spieler braucht es ${count} aktive Profile`); return; }
    const selectedStarter = Number(document.querySelector('input[name="starter"]:checked')?.value) || 0;
    const starter = Math.max(0, Math.min(count - 1, selectedStarter));
    const stamp = nowIso();
    const players = playerIds.map(id => profileName(id));
    state.settings.selectedProfileIds = [...playerIds];
    state.settings.playerCount = count;
    state.settings.nextStarter = (starter + 1) % count;
    state.settings.updatedAt = stamp;
    state.current = {
      id: nowId('game'), startedAt: stamp, updatedAt: stamp, starter,
      playerIds, players, title: safeText($('newGameTitle').value, 60), note: safeText($('newGameNote').value, 500),
      imageData: pendingGameImage, imageRef: '', imageMime: pendingGameImage.startsWith('data:image/png') ? 'image/png' : pendingGameImage ? 'image/jpeg' : '',
      yatzyFaces: emptyYatzyFaces(count),
      scores: emptyScores(count), completed: false, historyId: null
    };
    state.updatedAt = stamp;
    state.undo = [];
    saveState();
    $('newGameDialog').close();
    setGameMode(false);
    activatePage('game');
    renderAll();
    toast(`${players[starter]} beginnt`);
  }

  async function imageFileToDataUrl(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Bitte ein Bild auswählen');
    const source = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
      image.src = url;
    });
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(source.naturalWidth, source.naturalHeight));
    const width = Math.max(1, Math.round(source.naturalWidth * scale));
    const height = Math.max(1, Math.round(source.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(source, 0, 0, width, height);
    let data = canvas.toDataURL('image/jpeg', 0.76);
    if (data.length > 1_500_000) data = canvas.toDataURL('image/jpeg', 0.62);
    return data;
  }
  function renderPendingImage() {
    $('newGameImagePreview').classList.toggle('hidden', !pendingGameImage);
    if (pendingGameImage) $('newGameImagePreviewImg').src = pendingGameImage;
    else $('newGameImagePreviewImg').removeAttribute('src');
  }
  async function handleNewGameImage(file) {
    try {
      toast('Bild wird vorbereitet …');
      pendingGameImage = await imageFileToDataUrl(file);
      renderPendingImage();
      toast('Bild hinzugefügt');
    } catch (error) {
      pendingGameImage = '';
      renderPendingImage();
      toast(error.message || 'Bild konnte nicht gelesen werden');
    }
  }

  function renderSummaryMemoryImage() {
    const preview = $('summaryMemoryImagePreview');
    preview.classList.toggle('hidden', !pendingSummaryImage);
    if (pendingSummaryImage) $('summaryMemoryImagePreviewImg').src = pendingSummaryImage;
    else $('summaryMemoryImagePreviewImg').removeAttribute('src');
  }
  async function handleSummaryMemoryImage(file) {
    try {
      $('summaryMemoryStatus').textContent = 'Bild wird vorbereitet …';
      pendingSummaryImage = await imageFileToDataUrl(file);
      renderSummaryMemoryImage();
      $('summaryMemoryStatus').textContent = 'Bild ist bereit zum Speichern.';
    } catch (error) {
      $('summaryMemoryStatus').textContent = error.message || 'Bild konnte nicht gelesen werden.';
    }
  }
  function saveSummaryMemory({silent = false} = {}) {
    const record = state.history.find(item => item.id === activeSummaryId);
    if (!record) { if (!silent) toast('Spiel konnte nicht gefunden werden'); return false; }
    const title = safeText($('summaryMemoryTitle').value, 60);
    const note = safeText($('summaryMemoryNote').value, 500);
    const imageData = pendingSummaryImage || '';
    const imageChanged = imageData !== (record.imageData || '');
    const changed = title !== (record.title || '') || note !== (record.note || '') || imageChanged;
    if (!changed) {
      $('summaryMemoryStatus').textContent = 'Keine ungespeicherten Änderungen.';
      if (!silent) toast('Erinnerung ist bereits gespeichert');
      return true;
    }
    record.title = title;
    record.note = note;
    record.imageData = imageData;
    if (imageChanged) {
      record.imageRef = '';
      record.imageMime = imageData.startsWith('data:image/png') ? 'image/png' : imageData ? 'image/jpeg' : '';
    }
    if (state.current.historyId === record.id || state.current.id === record.id) {
      state.current.title = title;
      state.current.note = note;
      state.current.imageData = imageData;
      if (imageChanged) {
        state.current.imageRef = '';
        state.current.imageMime = record.imageMime;
      }
    }
    markChanged();
    renderAll();
    $('summaryMemoryStatus').textContent = 'Erinnerung gespeichert.';
    if (!silent) toast('Erinnerung gespeichert');
    return true;
  }
  function showSummary(record) {
    activeSummaryId = record.id;
    pendingSummaryImage = record.imageData || '';
    $('summaryWinner').textContent = winnerLabel(record);
    $('summaryScore').textContent = scoreLine(record);
    $('summaryMemoryTitle').value = record.title || '';
    $('summaryMemoryNote').value = record.note || '';
    $('summaryMemoryImage').value = '';
    $('summaryMemoryStatus').textContent = record.title || record.note || record.imageData ? 'Vorhandene Erinnerung kann noch angepasst werden.' : 'Noch keine Erinnerung gespeichert.';
    renderSummaryMemoryImage();
    const bonusNames = record.totals.map((total, index) => total.bonus ? record.players[index] : null).filter(Boolean);
    const yatzyText = record.players.map((name, index) => {
      const hasYatzy = Number(record.scores[index]?.yatzy || 0) > 0;
      const face = Number(record.yatzyFaces?.[index] || 0);
      return `${escapeHtml(name)}: ${hasYatzy ? (face >= 1 && face <= 6 ? `${DIE_FACE_ICONS[face]} Ja` : 'Ja') : 'Nein'}`;
    }).join('<br>');
    $('summaryGrid').innerHTML = `<div class="summary-tile"><small>Startspieler</small><strong>${escapeHtml(record.players[record.starter])}</strong></div><div class="summary-tile"><small>Vorsprung</small><strong>${record.margin} Punkte</strong></div><div class="summary-tile"><small>Bonus</small><strong>${bonusNames.length ? escapeHtml(bonusNames.join(' & ')) : '–'}</strong></div><div class="summary-tile"><small>Yatzy</small><strong>${yatzyText}</strong></div>`;
    $('summaryDialog').showModal();
  }

  function playerIndexInRecord(record, profileIdValue) {
    const originalId = String(profileIdValue || '');
    const targetId = resolveCatalogProfileId(originalId);
    const ids = Array.isArray(record?.playerIds) ? record.playerIds.map(value => String(value || '')) : [];
    const direct = ids.indexOf(originalId);
    if (direct >= 0) return direct;
    const canonical = ids.findIndex(id => id && resolveCatalogProfileId(id) === targetId);
    if (canonical >= 0) return canonical;
    const name = profileName(originalId, '');
    const targetName = normalisedCatalogProfileName(name);
    if (!targetName) return -1;
    const matches = (Array.isArray(record?.players) ? record.players : []).reduce((indices, player, index) => {
      if (normalisedCatalogProfileName(player) === targetName) indices.push(index);
      return indices;
    }, []);
    return matches.length === 1 ? matches[0] : -1;
  }
  function computePlayerStats(profileIdValue) {
    const matching = state.history.map(record => ({record, index: playerIndexInRecord(record, profileIdValue)})).filter(item => item.index >= 0);
    const scores = matching.map(item => item.record.totals[item.index].total);
    const wins = matching.filter(item => item.record.winners.length === 1 && item.record.winners[0] === item.index).length;
    const shared = matching.filter(item => item.record.winners.length > 1 && item.record.winners.includes(item.index)).length;
    const started = matching.filter(item => item.record.starter === item.index);
    const startedWins = started.filter(item => item.record.winners.length === 1 && item.record.winners[0] === item.index).length;
    return {
      games: matching.length,
      wins,
      shared,
      losses: matching.length - wins - shared,
      winRate: matching.length ? Math.round(wins / matching.length * 100) : 0,
      average: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
      high: scores.length ? Math.max(...scores) : 0,
      low: scores.length ? Math.min(...scores) : 0,
      bonusRate: matching.length ? Math.round(matching.filter(item => item.record.totals[item.index].bonus > 0).length / matching.length * 100) : 0,
      yatzyCount: matching.filter(item => Number(item.record.scores[item.index]?.yatzy || 0) > 0).length,
      startedGames: started.length,
      startedWinRate: started.length ? Math.round(startedWins / started.length * 100) : 0
    };
  }
  function serverProfileAggregate(profileIdValue) {
    const originalId = String(profileIdValue || '');
    const canonicalId = resolveCatalogProfileId(originalId);
    const catalog = deviceSettings.serverCatalog || {};
    // Ab Katalogschema 2 stammt Statistik und Badge-Auswertung aus demselben
    // kanonischen Profil-Spielbuch des Backends.
    return catalog.profileSummaries?.[canonicalId]
      || catalog.profileSummaries?.[originalId]
      || catalog.statsByProfile?.[canonicalId]
      || catalog.statsByProfile?.[originalId]
      || null;
  }
  function effectiveStats(profileIdValue) {
    const server = serverProfileAggregate(profileIdValue);
    return server ? {...server, winRate: server.games ? Math.round(server.wins / server.games * 100) : 0, source: 'server'} : {...computePlayerStats(profileIdValue), source: 'local'};
  }
  function categoryStatsForProfile(profileIdValue) {
    return allCategories.map(category => {
      const values = state.history.map(record => {
        const index = playerIndexInRecord(record, profileIdValue);
        return index >= 0 ? Number(record.scores[index]?.[category.id] || 0) : null;
      }).filter(value => value !== null);
      return {
        label: category.label,
        average: values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '0.0',
        zeroRate: values.length ? Math.round(values.filter(value => value === 0).length / values.length * 100) : 0,
        maximum: values.length ? Math.max(...values) : 0
      };
    });
  }

  function profileGameEntries(profileIdValue, history = state.history) {
    return history.map(record => {
      const index = playerIndexInRecord(record, profileIdValue);
      return index >= 0 ? {record, index} : null;
    }).filter(Boolean);
  }
  function badgeKeysForRecord(record, index) {
    const keys = ['games'];
    const winners = Array.isArray(record.winners) ? record.winners : [];
    const scores = record.scores?.[index] || {};
    if (winners.length === 1 && winners[0] === index) keys.push('wins');
    if (Number(scores.yatzy || 0) > 0) keys.push('yatzys');
    if (Number(record.totals?.[index]?.bonus || 0) > 0) keys.push('bonus');
    if (allCategories.every(category => Number(scores[category.id] || 0) > 0)) keys.push('noStrike');
    if (Number(scores.fullHouse || 0) > 0) keys.push('fullHouse');
    if (Number(scores.smallStraight || 0) > 0) keys.push('smallStraight');
    if (Number(scores.largeStraight || 0) > 0) keys.push('largeStraight');
    const yatzyFace = Number(record.yatzyFaces?.[index] || 0);
    if (Number(scores.yatzy || 0) > 0 && yatzyFace >= 1 && yatzyFace <= 6) keys.push(`yatzy${yatzyFace}`);
    return {keys, yatzyFace: yatzyFace >= 1 && yatzyFace <= 6 ? yatzyFace : 0};
  }
  function localBadgeEvents(profileIdValue, history = state.history, areaCode = state.areaCode || deviceSettings.syncCode || 'local') {
    return profileGameEntries(profileIdValue, history).map(({record, index}) => {
      const badgeData = badgeKeysForRecord(record, index);
      return {
        id: String(record.id || `${record.finishedAt || record.startedAt || nowIso()}-${index}`),
        area: areaCode,
        finishedAt: record.finishedAt || record.startedAt || '',
        keys: badgeData.keys,
        yatzyFace: badgeData.yatzyFace
      };
    });
  }
  function profileBadgeEvents(profileIdValue, history = state.history) {
    const originalId = String(profileIdValue || '');
    const canonicalId = resolveCatalogProfileId(originalId);
    const catalog = deviceSettings.serverCatalog || {};
    const serverEvents = catalog.badgeEventsByProfile?.[canonicalId] || catalog.badgeEventsByProfile?.[originalId];
    const localArea = state.areaCode || deviceSettings.syncCode || '';
    const localEvents = localBadgeEvents(originalId, history, localArea || 'local');
    const map = new Map();

    // Der vollständige Serverkatalog ist die Grundlage für die bereichsübergreifende
    // Badge-Sammlung. Lokale Ereignisse überschreiben nur dasselbe Spiel, sie löschen
    // aber niemals weitere bereits synchronisierte Spiele des aktuellen Bereichs.
    if (Array.isArray(serverEvents)) {
      serverEvents.forEach(event => {
        if (!event || !event.id) return;
        map.set(`${event.area || ''}:${event.id}`, event);
      });
    }
    localEvents.forEach(event => {
      if (!event || !event.id) return;
      map.set(`${event.area || localArea || 'local'}:${event.id}`, event);
    });
    return [...map.values()].sort((a, b) => timeValue(a.finishedAt) - timeValue(b.finishedAt));
  }
  const BADGE_COUNT_KEYS = TIERED_ACHIEVEMENTS.map(definition => definition.key);
  function emptyBadgeCounts() {
    return Object.fromEntries(BADGE_COUNT_KEYS.map(key => [key, 0]));
  }
  function badgeSummaryFromEvents(events, source = 'local') {
    const sorted = [...(Array.isArray(events) ? events : [])].sort((a, b) => timeValue(a?.finishedAt) - timeValue(b?.finishedAt));
    const counts = emptyBadgeCounts();
    const datesByKey = Object.fromEntries(BADGE_COUNT_KEYS.map(key => [key, []]));
    const areaGames = {};
    const rainbowFaces = new Set();
    let rainbowCompletedAt = '';
    let rainbowLastAt = '';

    sorted.forEach(event => {
      const keys = Array.isArray(event?.keys) ? [...new Set(event.keys.map(String))] : [];
      keys.forEach(key => {
        if (!hasOwn(counts, key)) return;
        counts[key] += 1;
        if (event.finishedAt) datesByKey[key].push(event.finishedAt);
      });
      if (keys.includes('games')) {
        const area = String(event?.area || 'lokal');
        areaGames[area] = (areaGames[area] || 0) + 1;
      }
      const face = Number(event?.yatzyFace || 0);
      if (face >= 1 && face <= 6 && keys.includes(`yatzy${face}`)) {
        rainbowFaces.add(face);
        rainbowLastAt = event.finishedAt || rainbowLastAt;
        if (!rainbowCompletedAt && rainbowFaces.size === 6) rainbowCompletedAt = event.finishedAt || '';
      }
    });

    const milestones = {};
    BADGE_COUNT_KEYS.forEach(key => {
      const dates = datesByKey[key];
      milestones[key] = {
        firstAt: dates[0] || '',
        lastAt: dates.at(-1) || '',
        bronzeAt: dates[0] || '',
        silverAt: dates[9] || '',
        goldAt: dates[24] || '',
        platinumAt: dates[99] || ''
      };
    });

    return {
      source,
      counts,
      gameCount: Number(counts.games || 0),
      areaCount: Object.keys(areaGames).length,
      areaGames,
      milestones,
      rainbowFaces,
      rainbowCompletedAt,
      rainbowLastAt,
      incomplete: false,
      expectedGames: Number(counts.games || 0)
    };
  }
  function normaliseBadgeSummary(raw, source = 'server') {
    const counts = emptyBadgeCounts();
    BADGE_COUNT_KEYS.forEach(key => { counts[key] = Math.max(0, Number(raw?.counts?.[key] || 0)); });
    const areaGames = {};
    Object.entries(raw?.areaGames || {}).forEach(([area, count]) => {
      const cleanCount = Math.max(0, Number(count || 0));
      if (cleanCount) areaGames[String(area || 'unbekannt')] = cleanCount;
    });
    const milestones = {};
    BADGE_COUNT_KEYS.forEach(key => {
      const item = raw?.milestones?.[key] || {};
      milestones[key] = {
        firstAt: String(item.firstAt || ''),
        lastAt: String(item.lastAt || ''),
        bronzeAt: String(item.bronzeAt || ''),
        silverAt: String(item.silverAt || ''),
        goldAt: String(item.goldAt || ''),
        platinumAt: String(item.platinumAt || '')
      };
    });
    const rainbowFaces = new Set((Array.isArray(raw?.rainbowFaces) ? raw.rainbowFaces : []).map(Number).filter(face => face >= 1 && face <= 6));
    return {
      source,
      counts,
      gameCount: Number(raw?.gameCount ?? counts.games),
      areaCount: Number(raw?.areaCount ?? Object.keys(areaGames).length),
      areaGames,
      milestones,
      rainbowFaces,
      rainbowCompletedAt: String(raw?.rainbowCompletedAt || ''),
      rainbowLastAt: String(raw?.rainbowLastAt || ''),
      incomplete: false,
      expectedGames: Number(raw?.gameCount ?? counts.games)
    };
  }
  function effectiveBadgeSummary(profileIdValue, history = state.history) {
    const catalog = deviceSettings.serverCatalog || {};
    const aggregate = serverProfileAggregate(profileIdValue);
    const hasUnifiedServerSummary = Number(catalog.catalogSchema || 0) >= 2
      && catalog.aggregation === 'canonical-profile-ledger'
      && aggregate?.badges?.counts;

    if (hasUnifiedServerSummary) {
      const summary = normaliseBadgeSummary(aggregate.badges, 'server-profile');
      summary.expectedGames = Number(aggregate.games || 0);
      summary.incomplete = summary.counts.games !== summary.expectedGames
        || summary.areaCount !== Number(aggregate.areaCount || 0);
      return summary;
    }

    const local = badgeSummaryFromEvents(localBadgeEvents(profileIdValue, history), 'local');
    local.expectedGames = Number(local.counts.games || 0);
    local.incomplete = deviceSettings.storageMode === 'synology' && Boolean(catalog.version);
    return local;
  }

  function achievementLevel(count) {
    let result = null;
    ACHIEVEMENT_LEVELS.forEach(level => { if (count >= level.threshold) result = level; });
    return result;
  }
  function nextAchievementLevel(count) { return ACHIEVEMENT_LEVELS.find(level => count < level.threshold) || null; }
  function achievementProgress(count) {
    const next = nextAchievementLevel(count);
    if (!next) return 100;
    const previous = [...ACHIEVEMENT_LEVELS].reverse().find(level => level.threshold <= count);
    const lower = previous?.threshold || 0;
    return Math.max(count ? 7 : 0, Math.min(100, ((count - lower) / Math.max(1, next.threshold - lower)) * 100));
  }
  function profileAchievementStats(profileIdValue, history = state.history) {
    const summary = effectiveBadgeSummary(profileIdValue, history);
    const counts = Object.fromEntries(TIERED_ACHIEVEMENTS.map(definition => [definition.key, Number(summary.counts?.[definition.key] || 0)]));
    const rainbowFaces = new Set(summary.rainbowFaces || []);
    return {
      counts,
      rainbowFaces,
      trackedYatzys: [1,2,3,4,5,6].reduce((sum, face) => sum + Number(counts[`yatzy${face}`] || 0), 0),
      summary
    };
  }
  function achievementUnlocks(profileIdValue, history = state.history) {
    const stats = profileAchievementStats(profileIdValue, history);
    const unlocks = [];
    TIERED_ACHIEVEMENTS.forEach(definition => {
      const count = stats.counts[definition.key] || 0;
      ACHIEVEMENT_LEVELS.forEach(level => {
        if (count >= level.threshold) unlocks.push({id: `${definition.key}:${level.key}`, ...definition, count, levelKey: level.key, levelLabel: level.label, threshold: level.threshold, legendary: false});
      });
    });
    if (stats.rainbowFaces.size === 6) unlocks.push({id: 'rainbow:legendary', key: 'rainbow', icon: '🌈', title: 'Regenbogen-Yatzy', description: 'Alle sechs Yatzy-Augenzahlen mindestens einmal gesammelt.', count: 6, levelKey: 'legendary', levelLabel: 'Legendär', threshold: 6, legendary: true});
    return unlocks;
  }
  function newAchievementUnlocks(before, after, playerName) {
    const existing = new Set(before.map(item => item.id));
    return after.filter(item => !existing.has(item.id)).map(item => ({...item, playerName}));
  }
  function achievementCard(definition, count) {
    const current = achievementLevel(count);
    const next = nextAchievementLevel(count);
    const levelClass = current ? `level-${current.key}` : 'is-locked';
    return `<article class="achievement-card ${levelClass}"><div class="achievement-card-top"><div class="achievement-medal"><span class="achievement-medal-icon">${definition.icon}</span></div><span class="achievement-level">${current ? current.label : 'Noch offen'}</span></div><div class="achievement-title">${escapeHtml(definition.title)}</div><div class="achievement-copy">${escapeHtml(definition.description)}</div><div class="achievement-count"><strong>${count}</strong><span>${next ? `Nächste Stufe bei ${next.threshold}` : 'Platin erreicht'}</span></div><div class="achievement-bar"><span style="width:${achievementProgress(count)}%"></span></div><div class="achievement-thresholds">Bronze 1 · Silber 10 · Gold 25 · Platin 100</div></article>`;
  }
  function rainbowAchievementCard(faces) {
    const unlocked = faces.size === 6;
    return `<article class="achievement-card level-legendary${unlocked ? '' : ' is-locked'}"><div class="achievement-card-top"><div class="achievement-medal"><span class="achievement-medal-icon">🌈</span></div><span class="achievement-level">${unlocked ? 'Legendär' : `${faces.size}/6`}</span></div><div class="achievement-title">Regenbogen-Yatzy</div><div class="achievement-copy">Jede Yatzy-Augenzahl von Einser bis Sechser mindestens einmal sammeln.</div><div class="rainbow-track">${[1,2,3,4,5,6].map(face => `<span class="rainbow-die${faces.has(face) ? ' done' : ''}">${DIE_FACE_ICONS[face]}</span>`).join('')}</div><div class="achievement-bar"><span style="width:${faces.size / 6 * 100}%"></span></div><div class="achievement-thresholds">${unlocked ? 'Alle sechs Arten gesammelt.' : `${faces.size} von 6 Arten gesammelt.`}</div></article>`;
  }
  function achievementSection(profileIdValue) {
    const stats = profileAchievementStats(profileIdValue);
    const unlocked = TIERED_ACHIEVEMENTS.filter(definition => achievementLevel(stats.counts[definition.key] || 0)).length + (stats.rainbowFaces.size === 6 ? 1 : 0);
    const legacyNote = stats.counts.yatzys > stats.trackedYatzys
      ? '<p class="achievement-note">Ältere Yatzys ohne gespeicherte Augenzahl zählen für das Gesamt-Yatzy-Badge, aber nicht rückwirkend für die sechs Augen-Badges oder das Regenbogen-Yatzy.</p>'
      : '';
    return `<section class="panel-card achievement-panel"><div class="achievement-head"><div><h3>Badges</h3><p>14 Badges mit Bronze, Silber, Gold und Platin sowie das legendäre Regenbogen-Yatzy. Die Auswertung folgt dem Spielerprofil über alle synchronisierten Spielbereiche hinweg.</p></div><div class="achievement-summary">Freigeschaltet <strong>${unlocked}/15</strong></div></div>${legacyNote}<div class="achievement-grid">${TIERED_ACHIEVEMENTS.map(definition => achievementCard(definition, stats.counts[definition.key] || 0)).join('')}${rainbowAchievementCard(stats.rainbowFaces)}</div></section>`;
  }

  function badgeOccurrenceEntries(profileIdValue, key, history = state.history) {
    return profileBadgeEvents(profileIdValue, history).filter(event => Array.isArray(event.keys) && event.keys.includes(key));
  }
  function badgeDefinition(key) {
    if (key === 'rainbow') return {key: 'rainbow', title: 'Regenbogen-Yatzy', description: 'Jede Yatzy-Augenzahl von Einser bis Sechser mindestens einmal sammeln.', image: badgeImageFor('rainbow'), legendary: true};
    const definition = TIERED_ACHIEVEMENTS.find(item => item.key === key);
    return definition ? {...definition, image: badgeImageFor(key), legendary: false} : null;
  }
  function shortDate(value) {
    if (!value) return '–';
    try { return new Intl.DateTimeFormat('de-CH', {dateStyle: 'medium'}).format(new Date(value)); }
    catch { return value; }
  }
  function rainbowCompletionData(profileIdValue) {
    const entries = profileBadgeEvents(profileIdValue);
    const faces = new Set();
    let completedAt = '';
    let lastAt = '';
    entries.forEach(event => {
      const face = Number(event.yatzyFace || 0);
      if (face >= 1 && face <= 6 && Array.isArray(event.keys) && event.keys.includes(`yatzy${face}`)) {
        faces.add(face);
        lastAt = event.finishedAt;
        if (!completedAt && faces.size === 6) completedAt = event.finishedAt;
      }
    });
    return {faces, completedAt, lastAt};
  }
  function badgeViewData(profileIdValue, definition, summary = effectiveBadgeSummary(profileIdValue)) {
    if (definition.legendary) {
      const faces = summary.rainbowFaces;
      return {definition, count: faces.size, current: faces.size === 6 ? {key:'legendary', label:'Legendär', threshold:6} : null, next: faces.size === 6 ? null : {key:'legendary', label:'Legendär', threshold:6}, progress: faces.size / 6 * 100, unlocked: faces.size === 6, firstAt: summary.rainbowCompletedAt, lastAt: summary.rainbowLastAt, rainbowFaces: faces};
    }
    const count = Number(summary.counts?.[definition.key] || 0);
    const current = achievementLevel(count);
    const next = nextAchievementLevel(count);
    const milestone = summary.milestones?.[definition.key] || {};
    const levelAt = current ? milestone[`${current.key}At`] || '' : '';
    return {definition, count, current, next, progress: achievementProgress(count), unlocked: count >= 1, firstAt: milestone.firstAt || '', lastAt: milestone.lastAt || '', levelAt, rainbowFaces: new Set()};
  }
  function badgeCardHtml(data) {
    const levelKey = data.current?.key || (data.definition.legendary ? 'legendary' : 'locked');
    const levelLabel = data.current?.label || (data.definition.legendary ? `${data.count}/6` : 'Noch offen');
    const nextText = data.definition.legendary ? `${data.count} / 6 Arten` : data.next ? `Nächste Stufe ${data.next.threshold}` : 'Platin erreicht';
    const lockedClass = data.unlocked ? '' : ' is-locked';
    const rainbow = data.definition.legendary ? `<div class="badge-rainbow-mini">${[1,2,3,4,5,6].map(face => `<span class="${data.rainbowFaces.has(face) ? 'done' : ''}">${DIE_FACE_ICONS[face]}</span>`).join('')}</div>` : `<div class="badge-mini-bar"><span style="width:${data.progress}%"></span></div>`;
    return `<button class="badge-vault-card level-${levelKey}${lockedClass}${data.definition.legendary ? ' legendary' : ''}" type="button" data-badge-key="${escapeHtml(data.definition.key)}"><div class="badge-progress-ring" style="--badge-progress:${data.progress}"><div class="badge-art-shell"><img class="badge-art" src="${data.definition.image}" alt="${escapeHtml(data.definition.title)}" loading="lazy" decoding="async"></div></div><span class="badge-card-level">${escapeHtml(levelLabel)}</span><div class="badge-card-title">${escapeHtml(data.definition.title)}</div><div class="badge-card-count"><strong>${data.definition.legendary ? `${data.count}/6` : data.count}</strong><span>${escapeHtml(nextText)}</span></div>${rainbow}</button>`;
  }
  function renderBadges() {
    const profiles = state.profiles.filter(profile => !profile.archived || state.history.some(record => record.playerIds?.includes(profile.id)));
    const select = $('badgesProfileSelect');
    if (!profiles.length) {
      $('badgesCountPill').textContent = '0 / 15';
      $('badgesUnlockedSummary').textContent = '0 / 15';
      $('badgesContent').innerHTML = '<div class="badge-empty">Lege zuerst ein Spielerprofil an.</div>';
      return;
    }
    const selectedId = profiles.some(profile => profile.id === deviceSettings.badgeProfileId) ? deviceSettings.badgeProfileId : (deviceSettings.statsProfileId && profiles.some(profile => profile.id === deviceSettings.statsProfileId) ? deviceSettings.statsProfileId : profiles[0].id);
    deviceSettings.badgeProfileId = selectedId;
    select.innerHTML = profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`).join('');
    select.value = selectedId;
    saveDeviceSettings();
    const badgeSummary = effectiveBadgeSummary(selectedId);
    const areaEntries = Object.entries(badgeSummary.areaGames || {}).sort((a, b) => a[0].localeCompare(b[0], 'de-CH'));
    const countedGameCount = Number(badgeSummary.counts.games || 0);
    const serverVersion = deviceSettings.serverCatalog?.version || '';
    if (badgeSummary.incomplete) {
      $('badgesAreaSummary').textContent = `Für eine einheitliche serverweite Berechnung wird Backend 2.4.0 benötigt. Bitte die einfache Portainer-YAML aktualisieren und danach «Serverliste» neu laden.${serverVersion ? ` Aktueller Server: ${serverVersion}.` : ''}`;
    } else if (areaEntries.length && badgeSummary.source === 'server-profile') {
      $('badgesAreaSummary').textContent = `${countedGameCount} Spiele aus ${areaEntries.length} Spielbereich${areaEntries.length === 1 ? '' : 'en'} werden serverweit aus derselben Datengrundlage wie das Spielerprofil gezählt: ${areaEntries.map(([area, count]) => `${area} (${count})`).join(' · ')}${serverVersion ? ` · Server ${serverVersion}` : ''}`;
    } else if (areaEntries.length) {
      $('badgesAreaSummary').textContent = `${countedGameCount} ${countedGameCount === 1 ? 'Spiel' : 'Spiele'} aus den lokal geladenen Daten werden gezählt.`;
    } else {
      $('badgesAreaSummary').textContent = deviceSettings.storageMode === 'synology'
        ? 'Noch keine serverweite Badge-Auswertung für dieses Profil. Bitte Docker-Backend aktualisieren und «Serverliste» laden.'
        : 'Im lokalen Modus zählen nur die Spiele auf diesem Gerät.';
    }
    const filter = ['all','unlocked','locked'].includes(deviceSettings.badgeFilter) ? deviceSettings.badgeFilter : 'all';
    document.querySelectorAll('[data-badge-filter]').forEach(button => button.classList.toggle('is-active', button.dataset.badgeFilter === filter));
    const definitions = [...TIERED_ACHIEVEMENTS.map(item => badgeDefinition(item.key)), badgeDefinition('rainbow')];
    const allData = definitions.map(definition => badgeViewData(selectedId, definition, badgeSummary));
    const unlocked = allData.filter(item => item.unlocked).length;
    $('badgesCountPill').textContent = `${unlocked} / 15`;
    $('badgesUnlockedSummary').textContent = `${unlocked} / 15`;
    const visible = allData.filter(item => filter === 'all' || (filter === 'unlocked' ? item.unlocked : !item.unlocked));
    $('badgesContent').innerHTML = visible.length ? `<div class="badge-vault-grid">${visible.map(badgeCardHtml).join('')}</div>` : '<div class="badge-empty">Für diesen Filter gibt es momentan keine Badges.</div>';
    $('badgesContent').querySelectorAll('[data-badge-key]').forEach(button => button.addEventListener('click', () => openBadgeDetail(selectedId, button.dataset.badgeKey)));
  }
  function openBadgeDetail(profileIdValue, key) {
    const definition = badgeDefinition(key);
    if (!definition) return;
    const data = badgeViewData(profileIdValue, definition);
    const levelKey = data.current?.key || (definition.legendary ? 'legendary' : 'locked');
    $('badgeDetailHeading').textContent = definition.title;
    $('badgeDetailImage').src = definition.image;
    $('badgeDetailImage').alt = definition.title;
    $('badgeDetailImageRing').style.setProperty('--badge-progress', data.progress);
    const levelColours = {bronze:'#c97f42', silver:'#d7e0ec', gold:'#f2c84b', platinum:'#9c95ff', legendary:'#e77cff', locked:'#73829a'};
    $('badgeDetailImageRing').style.setProperty('--level-colour', levelColours[levelKey] || levelColours.locked);
    $('badgeDetailLevel').textContent = data.current?.label || (definition.legendary ? `${data.count} von 6` : 'Noch offen');
    $('badgeDetailTitle').textContent = definition.title;
    $('badgeDetailCopy').textContent = definition.description;
    $('badgeDetailProgressText').textContent = definition.legendary ? `${data.count} von 6 Yatzy-Arten` : `${data.count} erreicht`;
    $('badgeDetailNextText').textContent = data.next ? `${data.next.label} bei ${data.next.threshold}` : (definition.legendary ? 'Legendär abgeschlossen' : 'Platin erreicht');
    $('badgeDetailProgressBar').style.width = `${data.progress}%`;
    $('badgeDetailRainbow').classList.toggle('hidden', !definition.legendary);
    if (definition.legendary) $('badgeDetailRainbow').innerHTML = [1,2,3,4,5,6].map(face => `<span class="${data.rainbowFaces.has(face) ? 'done' : ''}">${DIE_FACE_ICONS[face]}</span>`).join('');
    const levelDate = definition.legendary ? data.firstAt : data.levelAt;
    $('badgeDetailStats').innerHTML = `<div class="badge-detail-row"><span>Insgesamt erreicht</span><strong>${definition.legendary ? `${data.count} von 6 Arten` : data.count}</strong></div><div class="badge-detail-row"><span>Aktuelle Stufe</span><strong>${escapeHtml(data.current?.label || 'Noch offen')}</strong></div><div class="badge-detail-row"><span>Erstmals erreicht</span><strong>${shortDate(data.firstAt)}</strong></div><div class="badge-detail-row"><span>Aktuelle Stufe seit</span><strong>${shortDate(levelDate)}</strong></div><div class="badge-detail-row"><span>Zuletzt erreicht</span><strong>${shortDate(data.lastAt)}</strong></div>`;
    $('badgeDetailDialog').showModal();
  }
  function badgeProfilePreview(profileIdValue) {
    const definitions = [...TIERED_ACHIEVEMENTS.map(item => badgeDefinition(item.key)), badgeDefinition('rainbow')];
    const summary = effectiveBadgeSummary(profileIdValue);
    const data = definitions.map(definition => badgeViewData(profileIdValue, definition, summary));
    const unlocked = data.filter(item => item.unlocked).length;
    const highlight = data.find(item => item.definition.legendary && item.unlocked) || [...data].sort((a,b) => b.progress - a.progress)[0];
    const countText = summary.incomplete
      ? `${summary.counts.games} lokal geladene Spiele`
      : summary.source === 'server-profile'
        ? `${summary.counts.games} serverweit gezählte Spiele`
        : `${summary.counts.games} lokal gezählte Spiele`;
    return `<section class="panel-card"><div class="badge-profile-preview"><img src="${highlight?.definition.image || badgeImageFor('games')}" alt=""><div><h3>Badge-Sammlung</h3><p>${unlocked} von 15 Badges freigeschaltet · ${countText}. Fortschritt und Details findest du in der Vitrine.</p></div><button class="button secondary" type="button" id="openBadgesPageButton">Ansehen</button></div></section>`;
  }

  function statsColour(index) {
    return PLAYER_COLOURS[index] || `hsl(${(index * 47 + 18) % 360} 68% 48%)`;
  }
  function selectedAreaHistory() {
    const chronological = [...state.history].sort((a, b) => timeValue(a.finishedAt) - timeValue(b.finishedAt));
    const limit = Number.parseInt(deviceSettings.statsAreaRange, 10);
    return Number.isFinite(limit) ? chronological.slice(-limit) : chronological;
  }
  function uniqueProfileForName(name) {
    const matches = state.profiles.filter(profile => profile.name.trim().toLocaleLowerCase('de-CH') === String(name || '').trim().toLocaleLowerCase('de-CH'));
    return matches.length === 1 ? matches[0] : null;
  }
  function areaParticipants(history) {
    const participants = new Map();
    history.forEach(record => record.players.forEach((rawName, index) => {
      const explicitId = String(record.playerIds?.[index] || '');
      const matchedProfile = explicitId ? profileById(explicitId) : uniqueProfileForName(rawName);
      const profileIdValue = matchedProfile?.id || explicitId;
      const normalisedName = String(rawName || `Spieler ${index + 1}`).trim() || `Spieler ${index + 1}`;
      const key = profileIdValue ? `profile:${profileIdValue}` : `legacy:${normalisedName.toLocaleLowerCase('de-CH')}`;
      const name = matchedProfile?.name || normalisedName;
      if (!participants.has(key)) participants.set(key, {key, profileId: profileIdValue || '', legacyName: profileIdValue ? '' : normalisedName, name});
      else if (matchedProfile?.name) participants.get(key).name = matchedProfile.name;
    }));
    return [...participants.values()];
  }
  function areaPlayerIndex(record, participant) {
    if (participant.profileId) {
      const direct = record.playerIds?.indexOf(participant.profileId) ?? -1;
      if (direct >= 0) return direct;
      const currentName = profileName(participant.profileId, participant.name);
      const sameName = record.players.reduce((indices, name, index) => name === currentName ? [...indices, index] : indices, []);
      if (sameName.length === 1) return sameName[0];
      return -1;
    }
    const target = participant.legacyName.trim().toLocaleLowerCase('de-CH');
    return record.players.findIndex(name => String(name || '').trim().toLocaleLowerCase('de-CH') === target);
  }
  function computeAreaPlayerStats(participant, history) {
    const matching = history.map(record => ({record, index: areaPlayerIndex(record, participant)})).filter(item => item.index >= 0);
    const scores = matching.map(item => Number(item.record.totals[item.index]?.total || 0));
    const wins = matching.filter(item => item.record.winners.length === 1 && item.record.winners[0] === item.index).length;
    const shared = matching.filter(item => item.record.winners.length > 1 && item.record.winners.includes(item.index)).length;
    const started = matching.filter(item => item.record.starter === item.index);
    const notStarted = matching.filter(item => item.record.starter !== item.index);
    const startedWins = started.filter(item => item.record.winners.length === 1 && item.record.winners[0] === item.index).length;
    const notStartedWins = notStarted.filter(item => item.record.winners.length === 1 && item.record.winners[0] === item.index).length;
    let longestStreak = 0;
    let currentStreak = 0;
    matching.forEach(item => {
      if (item.record.winners.length === 1 && item.record.winners[0] === item.index) {
        currentStreak += 1;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else currentStreak = 0;
    });
    return {
      games: matching.length,
      wins,
      shared,
      losses: matching.length - wins - shared,
      winRate: matching.length ? Math.round(wins / matching.length * 100) : 0,
      average: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
      totalPoints: scores.reduce((sum, value) => sum + value, 0),
      high: scores.length ? Math.max(...scores) : 0,
      low: scores.length ? Math.min(...scores) : 0,
      bonusRate: matching.length ? Math.round(matching.filter(item => Number(item.record.totals[item.index]?.bonus || 0) > 0).length / matching.length * 100) : 0,
      yatzyCount: matching.filter(item => Number(item.record.scores[item.index]?.yatzy || 0) > 0).length,
      longestStreak,
      startedGames: started.length,
      startedWinRate: started.length ? Math.round(startedWins / started.length * 100) : 0,
      secondGames: notStarted.length,
      secondWinRate: notStarted.length ? Math.round(notStartedWins / notStarted.length * 100) : 0
    };
  }
  function areaPlayerCard(item, colourIndex, rank) {
    const stats = item.stats;
    return `<div class="stat-card area-player-card"><div class="area-player-head"><span class="area-player-name"><span class="stats-colour-dot" style="background:${statsColour(colourIndex)}"></span><span>${escapeHtml(item.participant.name)}</span></span><span class="area-rank">${rank}. Rang</span></div><div class="metric-list"><div class="metric-row"><span>Siege</span><strong>${stats.wins} (${stats.winRate}%)</strong></div><div class="metric-row"><span>Geteilte Siege</span><strong>${stats.shared}</strong></div><div class="metric-row"><span>Ø Punkte</span><strong>${stats.average}</strong></div><div class="metric-row"><span>Gesamtpunkte</span><strong>${stats.totalPoints}</strong></div><div class="metric-row"><span>Rekord / Tiefstwert</span><strong>${stats.high} / ${stats.low}</strong></div><div class="metric-row"><span>Bonusquote / Yatzys</span><strong>${stats.bonusRate}% / ${stats.yatzyCount}</strong></div></div></div>`;
  }
  function buildAreaTrendChart(history, participants) {
    if (!history.length || !participants.length) return '<div class="chart-empty">Noch keine Punkte für das Diagramm.</div>';
    const width = 640, height = 190, left = 36, right = 12, top = 14, bottom = 28;
    const values = history.flatMap(record => participants.map(participant => {
      const index = areaPlayerIndex(record, participant);
      return index >= 0 ? Number(record.totals[index]?.total || 0) : null;
    }).filter(value => value !== null));
    if (!values.length) return '<div class="chart-empty">Noch keine Punkte für das Diagramm.</div>';
    const minValue = Math.max(0, Math.floor((Math.min(...values) - 20) / 20) * 20);
    const maxValue = Math.max(minValue + 20, Math.ceil((Math.max(...values) + 20) / 20) * 20 || 300);
    const x = index => history.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (history.length - 1);
    const y = value => top + (maxValue - value) * (height - top - bottom) / Math.max(1, maxValue - minValue);
    const grid = [0, .25, .5, .75, 1].map(fraction => {
      const yy = top + fraction * (height - top - bottom);
      const label = Math.round(maxValue - fraction * (maxValue - minValue));
      return `<line x1="${left}" y1="${yy}" x2="${width - right}" y2="${yy}" stroke="var(--line)"/><text x="${left - 6}" y="${yy + 3}" text-anchor="end" font-size="10" fill="var(--muted)">${label}</text>`;
    }).join('');
    const paths = participants.map((participant, participantIndex) => {
      const valuesByGame = history.map(record => {
        const index = areaPlayerIndex(record, participant);
        return index >= 0 ? Number(record.totals[index]?.total || 0) : null;
      });
      const segments = [];
      let current = [];
      valuesByGame.forEach((value, gameIndex) => {
        if (value === null) {
          if (current.length) segments.push(current);
          current = [];
        } else current.push(`${x(gameIndex).toFixed(1)},${y(value).toFixed(1)}`);
      });
      if (current.length) segments.push(current);
      const colour = statsColour(participantIndex);
      return segments.map(points => points.length > 1 ? `<polyline fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}"/>` : '').join('');
    }).join('');
    const dots = history.map((record, gameIndex) => participants.map((participant, participantIndex) => {
      const index = areaPlayerIndex(record, participant);
      if (index < 0) return '';
      const total = Number(record.totals[index]?.total || 0);
      return `<circle cx="${x(gameIndex)}" cy="${y(total)}" r="3.25" fill="${statsColour(participantIndex)}"><title>${escapeHtml(participant.name)} · ${total} Punkte</title></circle>`;
    }).join('')).join('');
    return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Punkteverlauf im Spielbereich">${grid}${paths}${dots}<text x="${left}" y="${height - 6}" font-size="10" fill="var(--muted)">älter</text><text x="${width - right}" y="${height - 6}" text-anchor="end" font-size="10" fill="var(--muted)">neu</text></svg><div class="chart-legend">${participants.map((participant, index) => `<span class="legend-item"><span class="legend-dot" style="background:${statsColour(index)}"></span>${escapeHtml(participant.name)}</span>`).join('')}</div></div><p class="chart-caption">Fehlende Teilnahmen werden als Lücke dargestellt und nicht als null Punkte gezählt.</p>`;
  }
  function buildAreaCategoryStatsTable(participants, history) {
    const rows = allCategories.map(category => {
      const stats = participants.map(participant => {
        const values = history.map(record => {
          const index = areaPlayerIndex(record, participant);
          return index >= 0 ? Number(record.scores[index]?.[category.id] || 0) : null;
        }).filter(value => value !== null);
        return {
          average: values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '0.0',
          zeroRate: values.length ? Math.round(values.filter(value => value === 0).length / values.length * 100) : 0,
          maximum: values.length ? Math.max(...values) : 0
        };
      });
      return `<tr><td>${escapeHtml(category.label)}</td>${stats.map(item => `<td>${item.average}</td>`).join('')}${stats.map(item => `<td>${item.zeroRate}%</td>`).join('')}${stats.map(item => `<td>${item.maximum}</td>`).join('')}</tr>`;
    }).join('');
    return `<table class="category-table" style="min-width:${Math.max(560, 250 + participants.length * 210)}px"><thead><tr><th>Kategorie</th>${participants.map(participant => `<th>Ø ${escapeHtml(participant.name)}</th>`).join('')}${participants.map(participant => `<th>0 ${escapeHtml(participant.name)}</th>`).join('')}${participants.map(participant => `<th>Max ${escapeHtml(participant.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderAreaStats() {
    const container = $('statsContent');
    const history = selectedAreaHistory();
    const totalGames = state.history.length;
    $('statsSubtitle').textContent = 'Direkter Vergleich im aktuellen Spielbereich';
    $('statsAreaName').textContent = deviceSettings.syncCode || 'Lokaler Spielbereich';
    $('gamesCountPill').textContent = history.length === totalGames ? `${history.length} ${history.length === 1 ? 'Spiel' : 'Spiele'}` : `${history.length} / ${totalGames} Spiele`;
    if (!history.length) {
      container.innerHTML = '<div class="empty-card"><strong>Noch keine Spielbereichsstatistik</strong>Nach der ersten abgeschlossenen Runde erscheinen hier Vergleich, Punkteverlauf und Kategorien.</div>';
      return;
    }
    const participants = areaParticipants(history);
    const items = participants.map((participant, colourIndex) => ({participant, colourIndex, stats: computeAreaPlayerStats(participant, history)}));
    const ranking = [...items].sort((a, b) => b.stats.wins - a.stats.wins || b.stats.average - a.stats.average || a.participant.name.localeCompare(b.participant.name, 'de-CH'));
    const decisive = history.filter(record => record.winners.length === 1);
    const startWins = decisive.filter(record => record.winners[0] === record.starter).length;
    const starterWinRate = decisive.length ? Math.round(startWins / decisive.length * 100) : 0;
    const ties = history.filter(record => record.winners.length !== 1).length;
    const biggest = decisive.reduce((best, record) => !best || record.margin > best.margin ? record : best, null);
    const closest = decisive.reduce((best, record) => !best || record.margin < best.margin ? record : best, null);
    const comparison = ranking.length === 2
      ? `<div class="duel-score"><div class="duel-side"><div class="name">${escapeHtml(ranking[0].participant.name)}</div><div class="wins">${ranking[0].stats.wins}</div><div class="detail">${ranking[0].stats.winRate}% · Ø ${ranking[0].stats.average}</div></div><div class="separator">:</div><div class="duel-side"><div class="name">${escapeHtml(ranking[1].participant.name)}</div><div class="wins">${ranking[1].stats.wins}</div><div class="detail">${ranking[1].stats.winRate}% · Ø ${ranking[1].stats.average}</div></div></div>`
      : `<div class="comparison-score">${ranking.map((item, rank) => `<div class="comparison-row"><span class="name"><span class="stats-colour-dot" style="display:inline-block;margin-right:.38rem;background:${statsColour(item.colourIndex)}"></span>${escapeHtml(item.participant.name)}</span><span class="wins">${item.stats.wins}</span><span class="rank">${rank + 1}. Rang</span></div>`).join('')}</div>`;
    container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:.7rem"><div class="stat-card"><div class="label">Partien</div><div class="value">${history.length}</div><div class="sub">${ties} mit geteiltem Sieg</div></div><div class="stat-card"><div class="label">Startspieler gewinnt</div><div class="value">${starterWinRate}%</div><div class="sub">${startWins} von ${decisive.length}</div></div></div>
      <section class="panel-card"><h3>${ranking.length === 2 ? 'Direktes Duell' : 'Vergleich'}</h3>${comparison}<div class="metric-list"><div class="metric-row"><span>Grösster Sieg</span><strong>${biggest ? `${escapeHtml(biggest.players[biggest.winners[0]])} +${biggest.margin}` : '–'}</strong></div><div class="metric-row"><span>Knappster Sieg</span><strong>${closest ? `${escapeHtml(closest.players[closest.winners[0]])} +${closest.margin}` : '–'}</strong></div><div class="metric-row"><span>Längste Siegesserie</span><strong>${ranking.map(item => `${escapeHtml(item.participant.name)}: ${item.stats.longestStreak}`).join(' · ')}</strong></div></div></section>
      <div class="area-player-cards">${ranking.map((item, rank) => areaPlayerCard(item, item.colourIndex, rank + 1)).join('')}</div>
      <section class="panel-card"><h3>Punkteverlauf</h3>${buildAreaTrendChart(history, participants)}</section>
      <section class="panel-card"><h3>Startspieler-Auswertung</h3><div class="metric-list">${ranking.map(item => `<div class="metric-row"><span>${escapeHtml(item.participant.name)} beginnt</span><strong>${item.stats.startedGames} Spiele · ${item.stats.startedWinRate}% Siege</strong></div><div class="metric-row"><span>${escapeHtml(item.participant.name)} beginnt nicht</span><strong>${item.stats.secondGames} Spiele · ${item.stats.secondWinRate}% Siege</strong></div>`).join('')}</div></section>
      <section class="panel-card category-stats"><h3>Kategorien im Spielbereich</h3>${buildAreaCategoryStatsTable(participants, history)}</section>`;
  }
  function renderProfileStats() {
    const container = $('statsContent');
    const profiles = state.profiles.filter(profile => !profile.archived || state.history.some(record => record.playerIds?.includes(profile.id)));
    const select = $('statsProfileSelect');
    const selectedId = profiles.some(profile => profile.id === deviceSettings.statsProfileId) ? deviceSettings.statsProfileId : profiles[0]?.id || '';
    deviceSettings.statsProfileId = selectedId;
    saveDeviceSettings();
    select.innerHTML = profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`).join('');
    select.value = selectedId;
    $('statsSubtitle').textContent = 'Persönlich pro Spielerprofil';
    if (!profiles.length) {
      $('gamesCountPill').textContent = '0 Spiele';
      container.innerHTML = '<div class="empty-card"><strong>Noch keine Profile</strong>Lege zuerst ein Spielerprofil an.</div>';
      return;
    }
    const ranking = profiles.map(profile => ({profile, stats: effectiveStats(profile.id)})).sort((a, b) => b.stats.wins - a.stats.wins || b.stats.average - a.stats.average || a.profile.name.localeCompare(b.profile.name, 'de-CH'));
    const selectedProfile = profileById(selectedId) || profiles[0];
    const selected = effectiveStats(selectedProfile.id);
    const local = computePlayerStats(selectedProfile.id);
    $('gamesCountPill').textContent = `${selected.games || 0} ${selected.games === 1 ? 'Spiel' : 'Spiele'}`;
    const categoryRows = categoryStatsForProfile(selectedProfile.id).map(item => `<tr><td>${escapeHtml(item.label)}</td><td>${item.average}</td><td>${item.zeroRate}%</td><td>${item.maximum}</td></tr>`).join('');
    const selectedAreas = Object.entries(selected.areaGames || {}).sort((a, b) => a[0].localeCompare(b[0], 'de-CH'));
    const sourceNote = selected.source === 'server'
      ? `Serverweit aus derselben Datengrundlage wie die Badges: ${selected.games || 0} Spiele aus ${selected.areaCount || 0} Spielbereichen${selectedAreas.length ? ` · ${selectedAreas.map(([area, count]) => `${area} (${count})`).join(' · ')}` : ''}. Kategorien unten zeigen die lokal geladenen Spiele.`
      : 'Aus den Spielen auf diesem Gerät.';
    container.innerHTML = `
      <p class="server-stat-note">${escapeHtml(sourceNote)}</p>
      <section class="panel-card"><h3>Rangliste</h3><div class="profile-ranking">${ranking.map((item, rank) => `<div class="profile-ranking-row${item.profile.id === selectedProfile.id ? ' selected-profile-card' : ''}"><span class="rank">${rank + 1}.</span><span><strong>${escapeHtml(item.profile.name)}</strong><small>${item.stats.games} Spiele · ${item.stats.winRate}% Siegquote</small></span><span class="score"><strong>${item.stats.wins} Siege</strong><small>Ø ${item.stats.average}</small></span></div>`).join('')}</div></section>
      <div class="stats-grid" style="margin-bottom:.7rem">
        <div class="stat-card"><div class="label">Spiele</div><div class="value">${selected.games}</div><div class="sub">${selected.shared || 0} geteilte Siege</div></div>
        <div class="stat-card"><div class="label">Siege</div><div class="value">${selected.wins}</div><div class="sub">${selected.winRate}% Siegquote</div></div>
        <div class="stat-card"><div class="label">Ø Punkte</div><div class="value">${selected.average}</div><div class="sub">Rekord ${selected.high}</div></div>
        <div class="stat-card"><div class="label">Yatzys</div><div class="value">${selected.yatzyCount}</div><div class="sub">Bonusquote ${selected.bonusRate}%</div></div>
      </div>
      <section class="panel-card"><h3>${escapeHtml(selectedProfile.name)} lokal</h3><div class="metric-list"><div class="metric-row"><span>Tiefster Wert</span><strong>${local.low}</strong></div><div class="metric-row"><span>Als Startspieler</span><strong>${local.startedGames} Spiele · ${local.startedWinRate}% Siege</strong></div><div class="metric-row"><span>Niederlagen</span><strong>${local.losses}</strong></div></div></section>
      ${badgeProfilePreview(selectedProfile.id)}
      <section class="panel-card category-stats"><h3>Kategorien · lokal</h3><table class="category-table"><thead><tr><th>Kategorie</th><th>Ø</th><th>0</th><th>Max</th></tr></thead><tbody>${categoryRows}</tbody></table></section>`;
  }
  function renderStats() {
    const view = deviceSettings.statsView === 'profile' ? 'profile' : 'area';
    document.querySelectorAll('[data-stats-view]').forEach(button => button.classList.toggle('is-active', button.dataset.statsView === view));
    $('areaStatsControls').classList.toggle('hidden', view !== 'area');
    $('profileStatsControls').classList.toggle('hidden', view !== 'profile');
    $('statsAreaRangeSelect').value = deviceSettings.statsAreaRange;
    if (view === 'profile') renderProfileStats();
    else renderAreaStats();
  }

  function openPhotoViewer(id) {
    const record = state.history.find(item => item.id === id);
    if (!record?.imageData) return;
    $('photoDialogImage').src = record.imageData;
    $('photoDialogImage').alt = `Foto zu ${record.title || winnerLabel(record)}`;
    $('photoDialogCaption').textContent = `${record.title || winnerLabel(record)} · ${formatDate(record.finishedAt)}`;
    $('photoDialog').showModal();
  }
  function closePhotoViewer() {
    if ($('photoDialog').open) $('photoDialog').close();
  }
  function renderHistory() {
    $('historyCountPill').textContent = String(state.history.length);
    const container = $('historyContent');
    if (!state.history.length) {
      container.innerHTML = '<div class="empty-card"><strong>Noch kein Verlauf</strong>Abgeschlossene Runden werden mit Profilen, Notiz, Bild und komplettem Spielzettel gespeichert.</div>';
      return;
    }
    container.innerHTML = `<div class="history-list">${state.history.map(record => `<article class="history-card"><div class="history-main"><div><div class="history-date">${formatDate(record.finishedAt)}</div><div class="history-title history-title-line">${escapeHtml(record.title || winnerLabel(record))}${record.note || record.imageData ? '<span class="memory-badge">Erinnerung</span>' : ''}</div><div class="history-meta">${escapeHtml(winnerLabel(record))} · Start: ${escapeHtml(record.players[record.starter])} · Abstand ${record.margin}</div></div><div class="history-score">${scoreLine(record)}<small>${record.players.map(escapeHtml).join(' · ')}</small></div></div>${record.imageData ? `<button class="history-photo-preview" type="button" data-open-photo="${record.id}" aria-label="Foto zu ${escapeHtml(record.title || winnerLabel(record))} im Vollbild öffnen"><img src="${record.imageData}" alt="" loading="lazy" decoding="async"><span class="history-photo-label">📷 Foto ansehen</span></button>` : ''}<div class="history-actions"><button type="button" data-open-history="${record.id}">Spielzettel öffnen</button><button type="button" data-delete-history="${record.id}" aria-label="Spiel löschen">🗑</button></div></article>`).join('')}</div>`;
    container.querySelectorAll('[data-open-photo]').forEach(button => button.addEventListener('click', () => openPhotoViewer(button.dataset.openPhoto)));
    container.querySelectorAll('[data-open-history]').forEach(button => button.addEventListener('click', () => openHistoryDetail(button.dataset.openHistory)));
    container.querySelectorAll('[data-delete-history]').forEach(button => button.addEventListener('click', () => confirmDeleteHistory(button.dataset.deleteHistory)));
  }
  function openHistoryDetail(id) {
    const record = state.history.find(item => item.id === id);
    if (!record) return;
    activeHistoryId = id;
    $('historyDetailDate').textContent = formatDate(record.finishedAt);
    $('historyDetailTitle').textContent = record.title || winnerLabel(record);
    $('historyDetailMedia').innerHTML = `${record.imageData ? `<button class="history-detail-photo" type="button" data-open-detail-photo><img src="${record.imageData}" alt="Bild zur Runde"><span>Vollbild</span></button>` : ''}${record.note ? `<p class="history-note">${escapeHtml(record.note)}</p>` : ''}`;
    $('historyDetailMedia').querySelector('[data-open-detail-photo]')?.addEventListener('click', () => openPhotoViewer(record.id));
    const detailTable = $('historyDetailTable');
    const detailCount = record.players.length;
    const detailCategoryMin = detailCount <= 3 ? 112 : 102;
    const detailPlayerMin = detailCount <= 3 ? 68 : detailCount === 4 ? 62 : 58;
    detailTable.className = `detail-scorecard players-${detailCount}`;
    detailTable.style.setProperty('--detail-columns', `minmax(${detailCategoryMin}px, 1.35fr) repeat(${detailCount}, minmax(${detailPlayerMin}px, 1fr))`);
    detailTable.style.setProperty('--detail-min-width', detailCount <= 4 ? '100%' : `${detailCategoryMin + detailCount * detailPlayerMin}px`);
    const detailRow = (label, values, strong = false) => `<div class="detail-row">${strong ? `<strong>${escapeHtml(label)}</strong>` : `<span>${escapeHtml(label)}</span>`}${values.map(value => strong ? `<strong>${escapeHtml(value)}</strong>` : `<span>${Number(value) || 0}</span>`).join('')}</div>`;
    const rows = [
      detailRow('Kategorie', record.players, true),
      ...upperCategories.map(category => detailRow(category.label, record.scores.map(scores => scores[category.id]))),
      detailRow('Summe oben', record.totals.map(total => total.upper)),
      detailRow(`Bonus (${BONUS_POINTS})`, record.totals.map(total => total.bonus)),
      ...lowerCategories.map(category => detailRow(category.label, record.scores.map(scores => scores[category.id]))),
      detailRow('Gesamtsumme', record.totals.map(total => total.total), true)
    ];
    $('historyDetailTable').innerHTML = rows.join('');
    $('historyDialog').showModal();
  }
  function confirmDeleteHistory(id) {
    const record = state.history.find(item => item.id === id);
    if (!record) return;
    showConfirm('Spiel löschen?', `${formatDate(record.finishedAt)} · ${scoreLine(record)}`, 'Löschen', () => {
      state.history = state.history.filter(item => item.id !== id);
      markChanged();
      renderAll();
      toast('Spiel gelöscht');
    });
  }

  function renderProfileList() {
    const list = $('profileList');
    if (!list) return;
    const sorted = [...state.profiles].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'de-CH'));
    list.innerHTML = sorted.map(profile => {
      const stats = effectiveStats(profile.id);
      return `<div class="profile-row"><span class="profile-avatar">${escapeHtml(profileInitials(profile.name))}</span><span class="profile-copy"><strong>${escapeHtml(profile.name)}${profile.archived ? ' · ausgeblendet' : ''}</strong><span>${stats.games || 0} Spiele · ${stats.wins || 0} Siege · ID bleibt stabil</span></span><span class="profile-actions"><button type="button" data-edit-profile="${profile.id}" aria-label="Profil umbenennen">✎</button><button type="button" data-toggle-profile="${profile.id}" aria-label="${profile.archived ? 'Profil einblenden' : 'Profil ausblenden'}">${profile.archived ? '↩' : '−'}</button><button type="button" data-delete-profile="${profile.id}" aria-label="Profil löschen">🗑</button></span></div>`;
    }).join('');
    list.querySelectorAll('[data-edit-profile]').forEach(button => button.addEventListener('click', () => editProfile(button.dataset.editProfile)));
    list.querySelectorAll('[data-toggle-profile]').forEach(button => button.addEventListener('click', () => {
      const profile = profileById(button.dataset.toggleProfile);
      if (profile?.archived) restoreProfile(profile.id);
      else archiveProfile(profile?.id);
    }));
    list.querySelectorAll('[data-delete-profile]').forEach(button => button.addEventListener('click', () => deleteProfile(button.dataset.deleteProfile)));
  }

  function renderSettings() {
    renderProfileList();
    $('activeColumnModeSelect').value = state.settings.activeColumnMode || 'auto';
    $('keepScreenAwakeToggle').checked = state.settings.keepScreenAwake !== false;
    $('storageModeSelect').value = deviceSettings.storageMode;
    $('syncUrl').value = deviceSettings.syncUrl || '';
    renderSyncCodeOptions();
    $('cloudflareClientId').value = deviceSettings.cloudflareClientId || '';
    $('cloudflareClientSecret').value = deviceSettings.cloudflareClientSecret || '';
    $('autoSyncToggle').checked = deviceSettings.autoSync !== false;
    const mode = deviceSettings.storageMode;
    $('filePanel').classList.toggle('hidden', mode === 'local');
    $('synologyPanel').classList.toggle('hidden', mode !== 'synology');
    $('storageModeNote').textContent = mode === 'local'
      ? 'Alle Daten bleiben automatisch in dieser PWA. Für einen Gerätewechsel vorher eine Sicherung exportieren.'
      : mode === 'file'
        ? 'Beim Export öffnet iOS nach Möglichkeit das Teilen-Menü. Dort kannst du «In Dateien sichern», iCloud Drive oder Synology Drive wählen.'
        : 'Die lokalen Daten werden mit dem Sync-Dienst zusammengeführt. Spielcodes und Profile werden automatisch vom Server geladen.';
    const serverProfileCount = deviceSettings.serverCatalog?.profiles?.length || 0;
    const mergedIdentityCount = Number(deviceSettings.serverCatalog?.identityMergeCount || 0);
    const catalogVersion = deviceSettings.serverCatalog?.version || '';
    $('serverProfilesStatus').textContent = serverProfileCount
      ? `${serverProfileCount} Spielerprofile vom Server bekannt${mergedIdentityCount ? ` · ${mergedIdentityCount} ältere Doppel-ID${mergedIdentityCount === 1 ? '' : 's'} zusammengeführt` : ''}${catalogVersion ? ` · Server ${catalogVersion}` : ''} · zuletzt ${formatDate(deviceSettings.catalogFetchedAt)}`
      : 'Serverprofile werden nach der Verbindung automatisch ergänzt.';
    const customBadgeCount = Object.keys(serverBadgeImages).length;
    $('badgeImagesStatus').textContent = mode !== 'synology'
      ? 'Für serverweit eigene Badge-Bilder den Speichermodus «Synology» wählen.'
      : customBadgeCount
        ? `${customBadgeCount} von 15 Badge-Bildern wurden auf dem Server angepasst.`
        : 'Die eingebauten Standardbilder sind aktiv. Eigene Bilder können auf dem Server gespeichert werden.';
    if (state.settings.keepScreenAwake === false) releaseWakeLock(); else requestWakeLock();
    refreshWakeLockStatus();
    updateSyncStatus();
    if (mode === 'synology' && deviceSettings.syncUrl !== undefined && !catalogInProgress && (!deviceSettings.catalogFetchedAt || Date.now() - timeValue(deviceSettings.catalogFetchedAt) > 60_000)) refreshServerCatalog({silent: true});
  }

  function exportPayload() { const clean = clone(state); clean.undo = []; return clean; }
  async function exportData() {
    const filename = `yatzy-duell-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([JSON.stringify(exportPayload(), null, 2)], filename, {type: 'application/json'});
    try {
      if (navigator.canShare?.({files: [file]})) { await navigator.share({title: 'Yatzy Duell Sicherung', files: [file]}); toast('Sicherung bereitgestellt'); return; }
    } catch (error) { if (error?.name === 'AbortError') return; }
    downloadFile(file, filename);
    toast('Sicherung erstellt');
  }
  function importIdentityKey(playerIdValue, playerNameValue) {
    const id = String(playerIdValue || '').trim();
    if (id) return `id:${id}`;
    return `name:${safeName(playerNameValue).toLocaleLowerCase('de-CH')}`;
  }
  function collectImportIdentities(raw) {
    const identities = new Map();
    const profileNames = new Map();
    const add = (key, name, {sourceId = '', profileRaw = null, occurrence = false} = {}) => {
      if (!key) return;
      const clean = safeName(name, 'Spieler');
      const existing = identities.get(key);
      if (existing) {
        if ((!existing.name || /^Spieler \d+$/.test(existing.name)) && clean) existing.name = clean;
        if (sourceId && !existing.sourceId) existing.sourceId = sourceId;
        if (profileRaw && !existing.profileRaw) existing.profileRaw = profileRaw;
        if (occurrence) existing.occurrences += 1;
        return;
      }
      identities.set(key, {key, name: clean, sourceId, profileRaw, occurrences: occurrence ? 1 : 0});
    };
    if (Array.isArray(raw?.profiles)) {
      raw.profiles.forEach((profile, index) => {
        const id = String(profile?.id || '').trim();
        const name = safeName(profile?.name, `Spieler ${index + 1}`);
        if (id) profileNames.set(id, name);
        add(id ? `id:${id}` : importIdentityKey('', name), name, {sourceId: id, profileRaw: profile});
      });
    }
    const addSlots = container => {
      const count = Math.max(container?.playerIds?.length || 0, container?.players?.length || 0, container?.scores?.length || 0);
      for (let index = 0; index < count; index += 1) {
        const id = String(container?.playerIds?.[index] || '').trim();
        const name = safeName(container?.players?.[index] || profileNames.get(id), `Spieler ${index + 1}`);
        add(importIdentityKey(id, name), name, {sourceId: id, occurrence: true});
      }
    };
    addSlots(raw?.current);
    if (Array.isArray(raw?.history)) raw.history.forEach(addSlots);
    if (Array.isArray(raw?.settings?.players)) raw.settings.players.forEach((name, index) => add(importIdentityKey('', name), safeName(name, `Spieler ${index + 1}`), {occurrence: true}));
    if (Array.isArray(raw?.settings?.selectedProfileIds)) {
      raw.settings.selectedProfileIds.forEach((idValue, index) => {
        const id = String(idValue || '').trim();
        if (id) add(`id:${id}`, profileNames.get(id) || `Spieler ${index + 1}`, {sourceId: id});
      });
    }
    return [...identities.values()].sort((a, b) => a.name.localeCompare(b.name, 'de-CH') || a.key.localeCompare(b.key));
  }
  function suggestedLocalProfile(identity) {
    if (identity?.sourceId) {
      const sameId = state.profiles.find(profile => profile.id === identity.sourceId);
      if (sameId) return sameId;
    }
    const clean = safeName(identity?.name).toLocaleLowerCase('de-CH');
    return [...state.profiles]
      .filter(profile => profile.name.toLocaleLowerCase('de-CH') === clean)
      .sort((a, b) => Number(a.archived) - Number(b.archived) || timeValue(b.updatedAt) - timeValue(a.updatedAt))[0] || null;
  }
  function renderImportMapping() {
    if (!pendingImport) return;
    const identities = pendingImport.identities;
    const profiles = [...state.profiles].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'de-CH'));
    $('importMappingSummary').textContent = `${identities.length} Personen in «${pendingImport.fileName}» gefunden. Die Spiele werden ersetzt; bestehende Spielerprofile bleiben erhalten.`;
    $('importMappingList').innerHTML = identities.map((identity, index) => {
      const exact = suggestedLocalProfile(identity);
      const sourceNote = identity.sourceId ? `Datei-ID ${identity.sourceId.slice(0, 18)}${identity.sourceId.length > 18 ? '…' : ''}` : 'Alte Datei ohne Spieler-ID';
      const usage = `${identity.occurrences} ${identity.occurrences === 1 ? 'Verwendung' : 'Verwendungen'}`;
      const options = [
        `<option value="new">Neues Profil · neue ID</option>`,
        ...profiles.map(profile => {
          const sameNameCount = profiles.filter(item => item.name.toLocaleLowerCase('de-CH') === profile.name.toLocaleLowerCase('de-CH')).length;
          const idHint = sameNameCount > 1 ? ` · ID ${profile.id.slice(-6)}` : '';
          return `<option value="existing:${escapeHtml(profile.id)}"${exact?.id === profile.id ? ' selected' : ''}>${escapeHtml(profile.name)}${escapeHtml(idHint)}${profile.archived ? ' · ausgeblendet' : ''}</option>`;
        })
      ].join('');
      return `<div class="import-map-row"><div class="import-map-copy"><strong>${escapeHtml(identity.name)}</strong><span>${escapeHtml(sourceNote)} · ${usage}</span></div><label class="form-field" for="importMap${index}">Zielprofil<select class="select-input" id="importMap${index}" data-import-key="${escapeHtml(identity.key)}">${options}</select></label></div>`;
    }).join('');
  }
  function setImportMappingMode(mode) {
    if (!pendingImport) return;
    $('importMappingList').querySelectorAll('[data-import-key]').forEach(select => {
      const identity = pendingImport.identities.find(item => item.key === select.dataset.importKey);
      if (!identity) return;
      if (mode === 'new') select.value = 'new';
      else {
        const exact = suggestedLocalProfile(identity);
        select.value = exact ? `existing:${exact.id}` : 'new';
      }
    });
  }
  function uniqueImportedName(name, usedNames) {
    const base = safeName(name);
    let candidate = base;
    let number = 2;
    while (usedNames.has(candidate.toLocaleLowerCase('de-CH'))) {
      const suffix = ` ${number}`;
      candidate = `${base.slice(0, Math.max(1, 32 - suffix.length))}${suffix}`;
      number += 1;
    }
    usedNames.add(candidate.toLocaleLowerCase('de-CH'));
    return candidate;
  }
  function applyImportMapping() {
    if (!pendingImport) return;
    try {
      const prepared = clone(pendingImport.raw);
      const selections = new Map([...$('importMappingList').querySelectorAll('[data-import-key]')].map(select => [select.dataset.importKey, select.value]));
      const localProfiles = clone(state.profiles);
      const profileMap = new Map(localProfiles.map(profile => [profile.id, profile]));
      const usedNames = new Set(localProfiles.map(profile => profile.name.toLocaleLowerCase('de-CH')));
      const targets = new Map();
      let newCount = 0;
      let assignedCount = 0;
      pendingImport.identities.forEach(identity => {
        const selection = selections.get(identity.key) || 'new';
        if (selection.startsWith('existing:')) {
          const id = selection.slice('existing:'.length);
          const profile = profileMap.get(id);
          if (!profile) throw new Error('Ein ausgewähltes Zielprofil existiert nicht mehr.');
          targets.set(identity.key, profile);
          assignedCount += 1;
          return;
        }
        const stamp = identity.profileRaw?.createdAt || prepared.updatedAt || nowIso();
        const profile = makeProfile(uniqueImportedName(identity.name, usedNames), stamp);
        profile.archived = Boolean(identity.profileRaw?.archived);
        profile.updatedAt = identity.profileRaw?.updatedAt || identity.profileRaw?.createdAt || stamp;
        profileMap.set(profile.id, profile);
        targets.set(identity.key, profile);
        newCount += 1;
      });
      const rewriteSlots = container => {
        if (!container || typeof container !== 'object') return;
        const count = Math.max(container.playerIds?.length || 0, container.players?.length || 0, container.scores?.length || 0);
        if (!count) return;
        const ids = [];
        const names = [];
        for (let index = 0; index < count; index += 1) {
          const key = importIdentityKey(container.playerIds?.[index], container.players?.[index]);
          const profile = targets.get(key);
          if (!profile) continue;
          ids[index] = profile.id;
          names[index] = profile.name;
        }
        container.playerIds = ids;
        container.players = names;
      };
      rewriteSlots(prepared.current);
      if (Array.isArray(prepared.history)) prepared.history.forEach(rewriteSlots);
      if (!prepared.settings || typeof prepared.settings !== 'object') prepared.settings = {};
      if (Array.isArray(prepared.settings.selectedProfileIds)) {
        prepared.settings.selectedProfileIds = prepared.settings.selectedProfileIds.map(id => targets.get(`id:${String(id || '').trim()}`)?.id).filter(Boolean);
      }
      prepared.settings.players = undefined;
      prepared.profiles = [...profileMap.values()];
      const imported = normalizeState(prepared);
      state = imported;
      state.updatedAt = nowIso();
      state.current.updatedAt = state.updatedAt;
      saveState({queueSync: false});
      pendingImport = null;
      $('importMappingDialog').close();
      renderAll();
      activatePage('game');
      toast(`Daten importiert · ${assignedCount} zugeordnet · ${newCount} neu`);
    } catch (error) { toast(error.message || 'Import konnte nicht abgeschlossen werden'); }
  }
  async function importData(file) {
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || typeof raw !== 'object') throw new Error();
      const identities = collectImportIdentities(raw);
      if (!identities.length) throw new Error();
      pendingImport = {raw, identities, fileName: file.name || 'Sicherung.json'};
      renderImportMapping();
      $('importMappingDialog').showModal();
    } catch { toast('Die Datei konnte nicht gelesen werden'); }
    finally { $('importFile').value = ''; }
  }
  function downloadFile(file, filename) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function syncBase() { return (deviceSettings.syncUrl || location.origin).trim().replace(/\/+$/, ''); }
  function cloudflareHeaders() {
    const headers = {};
    if (deviceSettings.cloudflareClientId && deviceSettings.cloudflareClientSecret) {
      headers['CF-Access-Client-Id'] = deviceSettings.cloudflareClientId;
      headers['CF-Access-Client-Secret'] = deviceSettings.cloudflareClientSecret;
    }
    return headers;
  }
  function syncHeaders() { return {'Content-Type': 'application/json', ...cloudflareHeaders()}; }
  function validateServerSettings({requireCode = false} = {}) {
    if (requireCode && !isValidSyncCode(deviceSettings.syncCode)) { toast('Bitte einen Spielcode auswählen'); return false; }
    const hasId = Boolean(deviceSettings.cloudflareClientId);
    const hasSecret = Boolean(deviceSettings.cloudflareClientSecret);
    if (hasId !== hasSecret) { toast('Cloudflare Client ID und Secret vollständig eingeben'); return false; }
    try { new URL(syncBase()); }
    catch { toast('Serveradresse ist ungültig'); return false; }
    return true;
  }
  function syncEndpoint() { return `${syncBase()}/api/sync/${encodeURIComponent(deviceSettings.syncCode.trim())}`; }

  function mergeProfiles(localProfiles, remoteProfiles) {
    const map = new Map();
    [...(remoteProfiles || []), ...(localProfiles || [])].forEach(profileRaw => {
      if (!profileRaw?.id) return;
      const profile = normaliseProfile(profileRaw, profileRaw.name || 'Spieler');
      const existing = map.get(profile.id);
      if (!existing || timeValue(profile.updatedAt) >= timeValue(existing.updatedAt)) map.set(profile.id, profile);
    });
    return [...map.values()];
  }
  function mergeStates(localRaw, remoteRaw) {
    const local = normalizeState(localRaw);
    const remote = normalizeState(remoteRaw);
    const newer = timeValue(local.updatedAt) >= timeValue(remote.updatedAt) ? local : remote;
    const current = timeValue(local.current.updatedAt) >= timeValue(remote.current.updatedAt) ? local.current : remote.current;
    const historyMap = new Map();
    [...remote.history, ...local.history].forEach(record => {
      const existing = historyMap.get(record.id);
      if (!existing || timeValue(record.finishedAt) >= timeValue(existing.finishedAt)) historyMap.set(record.id, record);
    });
    return normalizeState({
      ...clone(newer),
      profiles: mergeProfiles(local.profiles, remote.profiles),
      current: clone(current),
      history: [...historyMap.values()].sort((a, b) => timeValue(b.finishedAt) - timeValue(a.finishedAt)),
      undo: local.undo,
      updatedAt: timeValue(local.updatedAt) >= timeValue(remote.updatedAt) ? local.updatedAt : remote.updatedAt
    });
  }
  function normalisedCatalogProfileName(value) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-CH');
  }
  function resolveCatalogProfileId(value, aliases = deviceSettings.serverCatalog?.profileAliases || {}) {
    const original = String(value || '');
    let id = original;
    const visited = new Set();
    while (aliases?.[id] && !visited.has(id)) { visited.add(id); id = String(aliases[id]); }
    const profile = state.profiles?.find(item => String(item.id) === original) || state.profiles?.find(item => String(item.id) === id);
    const byName = profile?.name ? deviceSettings.serverCatalog?.profileIdByName?.[normalisedCatalogProfileName(profile.name)] : '';
    return String(byName || id || original);
  }
  function applyCatalogProfileAliases(catalog) {
    const aliases = catalog?.profileAliases || {};
    if (!Object.keys(aliases).length) return false;
    let changed = false;
    const remap = value => {
      const original = String(value || '');
      const canonical = resolveCatalogProfileId(original, aliases);
      if (canonical !== original) changed = true;
      return canonical;
    };
    const remapContainer = container => {
      if (!container || !Array.isArray(container.playerIds)) return;
      container.playerIds = container.playerIds.map(remap);
    };
    remapContainer(state.current);
    state.history.forEach(remapContainer);
    state.settings.selectedProfileIds = [...new Set((state.settings.selectedProfileIds || []).map(remap))];
    deviceSettings.statsProfileId = remap(deviceSettings.statsProfileId);
    deviceSettings.badgeProfileId = remap(deviceSettings.badgeProfileId);
    const map = new Map();
    for (const profile of state.profiles) {
      const id = remap(profile.id);
      const next = {...profile, id};
      const existing = map.get(id);
      if (!existing || timeValue(next.updatedAt) >= timeValue(existing.updatedAt)) map.set(id, next);
    }
    state.profiles = [...map.values()];
    const names = new Map([...(catalog.profiles || []).map(profile => [String(profile.id), profile.name]), ...state.profiles.map(profile => [String(profile.id), profile.name])]);
    const rewriteNames = container => {
      if (!container || !Array.isArray(container.playerIds)) return;
      container.players = container.playerIds.map((id, index) => names.get(String(id)) || container.players?.[index] || `Spieler ${index + 1}`);
    };
    rewriteNames(state.current);
    state.history.forEach(rewriteNames);
    return changed;
  }
  function mergeCatalogProfiles(profiles, aliases = {}) {
    const before = JSON.stringify({profiles: state.profiles, current: state.current.playerIds, history: state.history.map(record => record.playerIds), selected: state.settings.selectedProfileIds});
    applyCatalogProfileAliases({profiles, profileAliases: aliases});
    state.profiles = mergeProfiles(state.profiles, profiles);
    const after = JSON.stringify({profiles: state.profiles, current: state.current.playerIds, history: state.history.map(record => record.playerIds), selected: state.settings.selectedProfileIds});
    if (after !== before) {
      state.updatedAt = nowIso();
      saveState({queueSync: false});
      saveDeviceSettings();
    }
  }
  async function refreshServerBadgeImages({silent = false, render = true} = {}) {
    if (!validateServerSettings()) return false;
    try {
      const payload = await serverManagementRequest('/api/badge-images');
      serverBadgeImages = payload.images && typeof payload.images === 'object' ? payload.images : {};
      if (render) { renderBadges(); renderSettings(); if ($('badgeImageManagerDialog')?.open) renderBadgeImageManager(); }
      return true;
    } catch (error) {
      if (!silent) toast(error.message || 'Badge-Bilder konnten nicht geladen werden');
      return false;
    }
  }
  async function loadBadgeCropImage(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Bitte ein Bild auswählen');
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
      image.src = url;
    });
  }
  function badgeCropPoint(event) {
    const canvas = $('badgeCropCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * BADGE_CROP_SIZE / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * BADGE_CROP_SIZE / Math.max(1, rect.height)
    };
  }
  function clampBadgeCrop() {
    if (!badgeCropState) return;
    const {image, scale} = badgeCropState;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    badgeCropState.x = Math.min(0, Math.max(BADGE_CROP_SIZE - width, badgeCropState.x));
    badgeCropState.y = Math.min(0, Math.max(BADGE_CROP_SIZE - height, badgeCropState.y));
  }
  function renderBadgeCrop() {
    if (!badgeCropState) return;
    clampBadgeCrop();
    const canvas = $('badgeCropCanvas');
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, BADGE_CROP_SIZE, BADGE_CROP_SIZE);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      badgeCropState.image,
      badgeCropState.x,
      badgeCropState.y,
      badgeCropState.image.naturalWidth * badgeCropState.scale,
      badgeCropState.image.naturalHeight * badgeCropState.scale
    );
    const percent = Math.round(badgeCropState.zoom * 100);
    $('badgeCropZoom').value = String(percent);
    $('badgeCropZoomValue').textContent = `${percent} %`;
  }
  function setBadgeCropZoom(nextZoom, anchorX = BADGE_CROP_SIZE / 2, anchorY = BADGE_CROP_SIZE / 2) {
    if (!badgeCropState) return;
    const zoom = Math.min(5, Math.max(1, Number(nextZoom) || 1));
    const oldScale = badgeCropState.scale;
    const sourceX = (anchorX - badgeCropState.x) / oldScale;
    const sourceY = (anchorY - badgeCropState.y) / oldScale;
    badgeCropState.zoom = zoom;
    badgeCropState.scale = badgeCropState.minScale * zoom;
    badgeCropState.x = anchorX - sourceX * badgeCropState.scale;
    badgeCropState.y = anchorY - sourceY * badgeCropState.scale;
    renderBadgeCrop();
  }
  function resetBadgeCrop() {
    if (!badgeCropState) return;
    badgeCropState.zoom = 1;
    badgeCropState.scale = badgeCropState.minScale;
    badgeCropState.x = (BADGE_CROP_SIZE - badgeCropState.image.naturalWidth * badgeCropState.scale) / 2;
    badgeCropState.y = (BADGE_CROP_SIZE - badgeCropState.image.naturalHeight * badgeCropState.scale) / 2;
    renderBadgeCrop();
  }
  function badgeCropDataUrl() {
    const canvas = $('badgeCropCanvas');
    let data = canvas.toDataURL('image/webp', .9);
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', .9);
    if (data.length > 2_600_000) data = canvas.toDataURL('image/jpeg', .74);
    return data;
  }
  function reopenBadgeImageManagerAfterCrop() {
    if (!badgeCropReturnToManager) return;
    badgeCropReturnToManager = false;
    renderBadgeImageManager();
    setTimeout(() => { if (!$('badgeImageManagerDialog').open) $('badgeImageManagerDialog').showModal(); }, 0);
  }
  function closeBadgeCropEditor({reopenManager = true} = {}) {
    const shouldReopen = reopenManager && badgeCropReturnToManager;
    badgeCropReturnToManager = false;
    badgeCropPointers.clear();
    badgeCropGesture = null;
    badgeCropState = null;
    if ($('badgeCropDialog').open) $('badgeCropDialog').close();
    if (shouldReopen) {
      renderBadgeImageManager();
      setTimeout(() => { if (!$('badgeImageManagerDialog').open) $('badgeImageManagerDialog').showModal(); }, 0);
    }
  }
  async function openBadgeCropEditor(key, file) {
    const definition = badgeDefinitions().find(item => item.key === key);
    if (!definition) return;
    try {
      toast('Bild wird geöffnet …');
      const image = await loadBadgeCropImage(file);
      const minScale = Math.max(BADGE_CROP_SIZE / image.naturalWidth, BADGE_CROP_SIZE / image.naturalHeight);
      badgeCropState = {key, definition, image, minScale, scale:minScale, zoom:1, x:0, y:0};
      badgeCropReturnToManager = $('badgeImageManagerDialog').open;
      if (badgeCropReturnToManager) $('badgeImageManagerDialog').close();
      $('badgeCropTitle').textContent = definition.title;
      resetBadgeCrop();
      $('badgeCropSave').disabled = false;
      $('badgeCropSave').textContent = 'Bild speichern';
      $('badgeCropDialog').showModal();
    } catch (error) {
      badgeCropState = null;
      toast(error.message || 'Bild konnte nicht geöffnet werden');
    }
  }
  function renderBadgeImageManager() {
    const grid = $('badgeImageManagerGrid');
    if (!grid) return;
    grid.innerHTML = badgeDefinitions().map(definition => {
      const custom = Boolean(serverBadgeImages[definition.key]);
      return `<article class="badge-image-manager-item"><div class="badge-image-manager-preview"><img src="${badgeImageFor(definition.key)}" alt="${escapeHtml(definition.title)}"></div><div class="badge-image-manager-copy"><strong>${escapeHtml(definition.title)}</strong><span>${custom ? 'Eigenes Serverbild' : 'Standardbild'}</span></div><div class="badge-image-manager-actions"><button class="button secondary" type="button" data-change-badge-image="${definition.key}">Ändern</button><button class="button secondary" type="button" data-reset-badge-image="${definition.key}" ${custom ? '' : 'disabled'}>Standard</button></div></article>`;
    }).join('');
  }
  async function saveBadgeCropImage() {
    if (!badgeCropState) return;
    const {key, definition} = badgeCropState;
    const button = $('badgeCropSave');
    button.disabled = true;
    button.textContent = 'Wird gespeichert …';
    try {
      const imageData = badgeCropDataUrl();
      const payload = await serverManagementRequest(`/api/badge-images/${encodeURIComponent(key)}`, {method:'PUT', body:{imageData}});
      serverBadgeImages[key] = payload.imageData || imageData;
      renderBadges(); renderSettings();
      closeBadgeCropEditor({reopenManager:true});
      toast(`${definition.title}: Bild gespeichert`);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Bild speichern';
      toast(error.message || 'Badge-Bild konnte nicht gespeichert werden');
    }
  }
  async function resetBadgeImage(key) {
    try {
      await serverManagementRequest(`/api/badge-images/${encodeURIComponent(key)}`, {method:'DELETE'});
      delete serverBadgeImages[key];
      renderBadgeImageManager(); renderBadges(); renderSettings();
      toast('Standardbild wiederhergestellt');
    } catch (error) { toast(error.message || 'Badge-Bild konnte nicht zurückgesetzt werden'); }
  }
  async function resetAllBadgeImages() {
    showConfirm('Alle Badge-Bilder zurücksetzen?', 'Alle eigenen Serverbilder werden entfernt. Die eingebauten Standardbilder bleiben erhalten.', 'Zurücksetzen', async () => {
      try {
        await serverManagementRequest('/api/badge-images', {method:'DELETE'});
        serverBadgeImages = {};
        renderBadgeImageManager(); renderBadges(); renderSettings();
        toast('Alle Standardbilder wiederhergestellt');
      } catch (error) { toast(error.message || 'Badge-Bilder konnten nicht zurückgesetzt werden'); }
    }, '🏅');
  }
  async function openBadgeImageManager() {
    readSyncForm();
    if (deviceSettings.storageMode !== 'synology') { toast('Für eigene Badge-Bilder zuerst Synology-Sync auswählen'); return; }
    if (!validateServerSettings()) return;
    await refreshServerBadgeImages({silent:true, render:false});
    renderBadgeImageManager();
    $('badgeImageManagerDialog').showModal();
  }

  function setSyncStatus(text, colour = 'var(--muted)') { $('syncStatusText').textContent = text; setStatusDot('syncStatusDot', colour); }
  function renderSyncCodeOptions() {
    const select = $('syncCodeSelect');
    if (!select) return;
    deviceSettings.syncCodes = normaliseSyncCodes([...(deviceSettings.syncCodes || []), deviceSettings.syncCode, ...(deviceSettings.serverCatalog?.codes || [])]);
    select.replaceChildren();
    if (!deviceSettings.syncCodes.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Noch kein Spielcode';
      select.append(option);
    } else {
      deviceSettings.syncCodes.forEach(code => {
        const area = deviceSettings.serverCatalog?.areas?.find(item => item.code === code);
        const option = document.createElement('option');
        option.value = code;
        option.textContent = area ? `${code} · ${area.gameCount} Spiele` : code;
        select.append(option);
      });
    }
    select.value = deviceSettings.syncCode || '';
    const hasCode = Boolean(deviceSettings.syncCode);
    $('renameSyncCodeButton').disabled = !hasCode;
    $('removeSyncCodeButton').disabled = !hasCode;
    $('deleteServerAreaButton').disabled = !hasCode;
    $('activeSyncCodeLabel').textContent = deviceSettings.syncCode || 'Keiner';
  }
  function askSyncCode(message, initial = '') {
    const entered = window.prompt(message, initial);
    if (entered === null) return null;
    const code = entered.trim();
    if (!isValidSyncCode(code)) { toast('Spielcode: 3–40 Zeichen, Buchstaben, Zahlen, _ oder -'); return null; }
    return code;
  }
  function setActiveSyncCode(code, {announce = true} = {}) {
    const clean = String(code || '').trim();
    deviceSettings.syncCode = isValidSyncCode(clean) ? clean : '';
    deviceSettings.syncCodes = normaliseSyncCodes([...(deviceSettings.syncCodes || []), deviceSettings.syncCode]);
    deviceSettings.lastSyncAt = deviceSettings.syncCode ? deviceSettings.lastSyncByCode?.[deviceSettings.syncCode] || null : null;
    saveDeviceSettings();
    renderSyncCodeOptions();
    updateSyncStatus();
    if (announce) toast(deviceSettings.syncCode ? `Sync-Bereich «${deviceSettings.syncCode}» ausgewählt` : 'Kein Spielcode ausgewählt');
  }
  async function switchSyncArea(code, {announce = true, preferServer = true} = {}) {
    const clean = String(code || '').trim();
    if (!isValidSyncCode(clean) || syncInProgress) return false;
    const previousCode = deviceSettings.syncCode;
    const previousState = clone(state);
    if (isValidSyncCode(state.areaCode)) saveAreaCache(state, state.areaCode);
    setActiveSyncCode(clean, {announce: false});

    const cached = loadAreaCache(clean);
    if (cached) {
      state = cached;
      saveState({queueSync: false});
      renderAll();
    }

    if (preferServer && deviceSettings.storageMode === 'synology') {
      syncInProgress = true;
      setSyncStatus(`Spielbereich «${clean}» wird geladen …`, 'var(--accent)');
      try {
        const response = await fetch(`${syncBase()}/api/sync/${encodeURIComponent(clean)}`, {method: 'GET', headers: syncHeaders(), cache: 'no-store'});
        if (response.ok) {
          const payload = await response.json();
          state = normalizeState(payload.data || payload);
          state.areaCode = clean;
          saveState({queueSync: false});
          recordSyncSuccess();
          await refreshServerCatalog({silent: true});
          renderAll();
          if (announce) toast(`Spielbereich «${clean}» geladen`);
          return true;
        }
        if (response.status !== 404) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
      } catch (error) {
        if (!cached) {
          deviceSettings.syncCode = previousCode;
          state = previousState;
          saveDeviceSettings();
          saveState({queueSync: false});
          renderAll();
          toast(error.message || 'Spielbereich konnte nicht geladen werden');
          return false;
        }
        if (announce) toast(`Spielbereich «${clean}» aus dem lokalen Zwischenspeicher geladen`);
        return true;
      } finally {
        syncInProgress = false;
        updateSyncStatus();
      }
    }

    if (!cached) {
      state = makeEmptyAreaState(clean);
      saveState({queueSync: false});
      renderAll();
    }
    if (announce) toast(`Spielbereich «${clean}» ausgewählt`);
    return true;
  }

  async function addSyncCode() {
    readSyncForm();
    const code = askSyncCode('Neuen Spielcode eingeben');
    if (!code) return;
    const knownOnServer = Boolean(deviceSettings.serverCatalog?.codes?.includes(code));
    const knownLocally = deviceSettings.syncCodes.includes(code);
    if (knownOnServer || knownLocally) {
      await switchSyncArea(code);
      return;
    }

    if (isValidSyncCode(state.areaCode)) saveAreaCache(state, state.areaCode);
    deviceSettings.syncCodes.push(code);
    setActiveSyncCode(code, {announce: false});
    state = makeEmptyAreaState(code);
    saveState({queueSync: false});
    renderAll();

    if (deviceSettings.storageMode === 'synology' && validateServerSettings({requireCode: true})) {
      syncInProgress = true;
      setSyncStatus(`Leerer Spielbereich «${code}» wird erstellt …`, 'var(--accent)');
      try {
        const response = await fetch(`${syncBase()}/api/sync/${encodeURIComponent(code)}`, {
          method: 'PUT',
          headers: syncHeaders(),
          body: JSON.stringify({data: state})
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
        recordSyncSuccess();
        await refreshServerCatalog({silent: true});
        toast(`Leerer Spielbereich «${code}» erstellt`);
      } catch (error) {
        toast(`${error.message || 'Server nicht erreichbar'} · Bereich bleibt lokal leer`);
      } finally {
        syncInProgress = false;
        updateSyncStatus();
      }
    } else {
      toast(`Leerer Spielbereich «${code}» lokal erstellt`);
    }
  }
  async function renameSyncCode() {
    const oldCode = deviceSettings.syncCode;
    if (!oldCode) return;
    const code = askSyncCode('Spielcode lokal umbenennen', oldCode);
    if (!code || code === oldCode) return;
    if (deviceSettings.syncCodes.includes(code)) { toast('Dieser Spielcode ist bereits in der Liste'); return; }
    deviceSettings.syncCodes = deviceSettings.syncCodes.map(item => item === oldCode ? code : item);
    await switchSyncArea(code, {announce: false});
    toast(`Neuer leerer Code «${code}» aktiv. Der alte Serverbereich bleibt bestehen.`);
  }
  function removeSyncCode() {
    const code = deviceSettings.syncCode;
    if (!code) return;
    showConfirm('Spielcode aus Liste entfernen?', `«${code}» wird nur auf diesem Gerät aus der Auswahl entfernt. Serverdaten bleiben bestehen.`, 'Entfernen', async () => {
      deviceSettings.syncCodes = deviceSettings.syncCodes.filter(item => item !== code);
      const nextCode = deviceSettings.syncCodes[0] || '';
      if (nextCode) await switchSyncArea(nextCode, {announce: false});
      else setActiveSyncCode('', {announce: false});
      toast('Spielcode aus der lokalen Liste entfernt');
    }, '🗂️');
  }
  function recordSyncSuccess() {
    const timestamp = nowIso();
    deviceSettings.lastSyncAt = timestamp;
    if (deviceSettings.syncCode) {
      deviceSettings.lastSyncByCode = deviceSettings.lastSyncByCode || {};
      deviceSettings.lastSyncByCode[deviceSettings.syncCode] = timestamp;
    }
    saveDeviceSettings();
  }
  function updateSyncStatus() {
    if (deviceSettings.storageMode !== 'synology') { setSyncStatus('Synology-Sync ist nicht ausgewählt'); return; }
    if (!deviceSettings.syncCode) { setSyncStatus('Serverliste laden oder einen Spielcode anlegen', 'var(--warning)'); return; }
    if (syncInProgress || catalogInProgress) { setSyncStatus(`Verbindung zu «${deviceSettings.syncCode}» läuft …`, 'var(--accent)'); return; }
    if (deviceSettings.lastSyncAt) { setSyncStatus(`«${deviceSettings.syncCode}» · zuletzt synchronisiert: ${formatDate(deviceSettings.lastSyncAt)}`, 'var(--success)'); return; }
    setSyncStatus(`«${deviceSettings.syncCode}» · noch nicht synchronisiert`, 'var(--warning)');
  }
  function readSyncForm() {
    deviceSettings.syncUrl = $('syncUrl').value.trim();
    deviceSettings.syncCode = $('syncCodeSelect').value.trim();
    deviceSettings.syncCodes = normaliseSyncCodes([...(deviceSettings.syncCodes || []), deviceSettings.syncCode]);
    deviceSettings.cloudflareClientId = $('cloudflareClientId').value.trim();
    deviceSettings.cloudflareClientSecret = $('cloudflareClientSecret').value.trim();
    deviceSettings.autoSync = $('autoSyncToggle').checked;
    deviceSettings.lastSyncAt = deviceSettings.syncCode ? deviceSettings.lastSyncByCode?.[deviceSettings.syncCode] || deviceSettings.lastSyncAt || null : null;
    saveDeviceSettings();
  }
  async function refreshServerCatalog({silent = false} = {}) {
    if (catalogInProgress) return false;
    readSyncForm();
    if (!validateServerSettings()) return false;
    catalogInProgress = true;
    updateSyncStatus();
    try {
      const response = await fetch(`${syncBase()}/api/catalog`, {headers: {'Accept': 'application/json', ...cloudflareHeaders()}, cache: 'no-store'});
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
      const catalog = await response.json();
      deviceSettings.serverCatalog = catalog;
      deviceSettings.catalogFetchedAt = nowIso();
      deviceSettings.syncCodes = normaliseSyncCodes([...(deviceSettings.syncCodes || []), ...(catalog.codes || [])]);
      if (!deviceSettings.syncCode && deviceSettings.syncCodes.length) deviceSettings.syncCode = deviceSettings.syncCodes[0];
      mergeCatalogProfiles(catalog.profiles || [], catalog.profileAliases || {});
      await refreshServerBadgeImages({silent: true, render: false});
      saveDeviceSettings();
      renderAll();
      if (!silent) toast(`${catalog.codes?.length || 0} Spielbereiche und ${catalog.profiles?.length || 0} Profile geladen`);
      return true;
    } catch (error) {
      if (!silent) toast(error.message || 'Serverliste konnte nicht geladen werden');
      setSyncStatus('Serverliste konnte nicht geladen werden', 'var(--danger)');
      return false;
    } finally {
      catalogInProgress = false;
      updateSyncStatus();
    }
  }
  async function testSync() {
    readSyncForm();
    if (!validateServerSettings()) return;
    setSyncStatus('Verbindung wird geprüft …', 'var(--accent)');
    try {
      const response = await fetch(`${syncBase()}/api/health`, {headers: {'Accept': 'application/json', ...cloudflareHeaders()}, cache: 'no-store'});
      if (!response.ok) throw new Error();
      await refreshServerCatalog({silent: true});
      setSyncStatus('Sync-Dienst ist erreichbar', 'var(--success)');
      toast('Verbindung erfolgreich');
    } catch {
      setSyncStatus('Sync-Dienst nicht erreichbar', 'var(--danger)');
      toast('Verbindung fehlgeschlagen');
    }
  }
  async function syncNow({silent = false} = {}) {
    if (syncInProgress) return false;
    readSyncForm();
    if (!validateServerSettings({requireCode: true})) return false;
    syncInProgress = true;
    updateSyncStatus();
    try {
      let remote = null;
      const getResponse = await fetch(syncEndpoint(), {method: 'GET', headers: syncHeaders(), cache: 'no-store'});
      if (getResponse.ok) { const payload = await getResponse.json(); remote = payload.data || payload; }
      else if (getResponse.status !== 404) throw new Error((await getResponse.json().catch(() => ({}))).error || `HTTP ${getResponse.status}`);
      const activeCode = deviceSettings.syncCode.trim();
      let localArea = state.areaCode === activeCode ? normalizeState(state) : loadAreaCache(activeCode);
      if (!localArea) localArea = makeEmptyAreaState(activeCode);
      localArea.areaCode = activeCode;
      const merged = remote ? mergeStates(localArea, remote) : localArea;
      merged.areaCode = activeCode;
      const putResponse = await fetch(syncEndpoint(), {method: 'PUT', headers: syncHeaders(), body: JSON.stringify({data: merged})});
      if (!putResponse.ok) throw new Error((await putResponse.json().catch(() => ({}))).error || `HTTP ${putResponse.status}`);
      state = merged;
      saveState({queueSync: false});
      recordSyncSuccess();
      await refreshServerCatalog({silent: true});
      renderAll();
      if (!silent) toast('Synchronisierung abgeschlossen');
      return true;
    } catch (error) {
      setSyncStatus('Synchronisierung fehlgeschlagen', 'var(--danger)');
      if (!silent) toast(error.message || 'Synchronisierung fehlgeschlagen');
      return false;
    } finally {
      syncInProgress = false;
      updateSyncStatus();
    }
  }
  async function uploadLocalToServer({silent = false} = {}) {
    if (syncInProgress) return false;
    readSyncForm();
    if (!validateServerSettings({requireCode: true})) return false;
    syncInProgress = true;
    setSyncStatus('Lokale Daten werden hochgeladen …', 'var(--accent)');
    try {
      const activeCode = deviceSettings.syncCode.trim();
      let local = state.areaCode === activeCode ? normalizeState(state) : loadAreaCache(activeCode);
      if (!local) local = makeEmptyAreaState(activeCode);
      local.areaCode = activeCode;
      local.updatedAt = nowIso();
      const response = await fetch(syncEndpoint(), {method: 'PUT', headers: syncHeaders(), body: JSON.stringify({data: local})});
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
      state = local;
      saveState({queueSync: false});
      recordSyncSuccess();
      await refreshServerCatalog({silent: true});
      renderAll();
      if (!silent) toast('Lokale Daten auf Server hochgeladen');
      return true;
    } catch (error) {
      setSyncStatus('Hochladen fehlgeschlagen', 'var(--danger)');
      if (!silent) toast(error.message || 'Hochladen fehlgeschlagen');
      return false;
    } finally {
      syncInProgress = false;
      updateSyncStatus();
    }
  }
  async function downloadServerToLocal({silent = false} = {}) {
    if (syncInProgress) return false;
    readSyncForm();
    if (!validateServerSettings({requireCode: true})) return false;
    syncInProgress = true;
    setSyncStatus('Serverdaten werden geladen …', 'var(--accent)');
    try {
      const response = await fetch(syncEndpoint(), {method: 'GET', headers: syncHeaders(), cache: 'no-store'});
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
      const payload = await response.json();
      state = normalizeState(payload.data || payload);
      state.areaCode = deviceSettings.syncCode;
      saveState({queueSync: false});
      recordSyncSuccess();
      await refreshServerCatalog({silent: true});
      renderAll();
      if (!silent) toast('Serverdaten auf dieses Gerät geladen');
      return true;
    } catch (error) {
      setSyncStatus('Laden fehlgeschlagen', 'var(--danger)');
      if (!silent) toast(error.message || 'Laden fehlgeschlagen');
      return false;
    } finally {
      syncInProgress = false;
      updateSyncStatus();
    }
  }
  async function deleteServerArea() {
    readSyncForm();
    if (!validateServerSettings({requireCode: true})) return;
    const code = deviceSettings.syncCode;
    const typed = window.prompt(`Zum endgültigen Löschen des Server-Spielbereichs «${code}» den Spielcode nochmals eingeben:`);
    if (typed === null) return;
    if (typed.trim() !== code) { toast('Bestätigung stimmt nicht überein'); return; }
    try {
      syncInProgress = true;
      setSyncStatus(`Spielbereich «${code}» wird gesichert und gelöscht …`, 'var(--danger)');
      await serverManagementRequest(`/api/areas/${encodeURIComponent(code)}`, {method: 'DELETE'});
      deviceSettings.syncCodes = deviceSettings.syncCodes.filter(item => item !== code);
      delete deviceSettings.lastSyncByCode?.[code];
      setActiveSyncCode(deviceSettings.syncCodes[0] || '', {announce: false});
      await refreshServerCatalog({silent: true});
      renderAll();
      toast(`Spielbereich «${code}» gelöscht · Backup erstellt`);
    } catch (error) {
      toast(error.message || 'Spielbereich konnte nicht gelöscht werden');
    } finally {
      syncInProgress = false;
      updateSyncStatus();
    }
  }
  async function resetServer() {
    readSyncForm();
    if (!validateServerSettings()) return;
    const typed = window.prompt('Dieser Vorgang löscht alle Spielbereiche, Profile, Statistiken, Bilder und Badge-Bilder auf dem Server. Lokale Daten bleiben bestehen. Zur Bestätigung exakt SERVER LÖSCHEN eingeben:');
    if (typed === null) return;
    if (typed.trim() !== 'SERVER LÖSCHEN') { toast('Server-Reset abgebrochen'); return; }
    try {
      syncInProgress = true;
      setSyncStatus('Komplette Serversicherung wird erstellt …', 'var(--danger)');
      const result = await serverManagementRequest('/api/reset', {method: 'DELETE'});
      deviceSettings.autoSync = false;
      deviceSettings.syncCode = '';
      deviceSettings.syncCodes = [];
      deviceSettings.lastSyncAt = null;
      deviceSettings.lastSyncByCode = {};
      deviceSettings.serverCatalog = {version: APP_VERSION, catalogSchema: 2, aggregation: 'canonical-profile-ledger', updatedAt: nowIso(), codes: [], areas: [], profiles: [], profileAliases: {}, profileIdByName: {}, identityMergeCount: 0, profileSummaries: {}, statsByProfile: {}, badgeEventsByProfile: {}, badgeStatsByProfile: {}, badgeAreaGamesByProfile: {}};
      serverBadgeImages = {};
      deviceSettings.catalogFetchedAt = nowIso();
      saveDeviceSettings();
      renderAll();
      toast(`Server zurückgesetzt · ${result.deletedAreas || 0} Bereiche gesichert`);
    } catch (error) {
      toast(error.message || 'Server konnte nicht zurückgesetzt werden');
    } finally {
      syncInProgress = false;
      updateSyncStatus();
    }
  }

  function scheduleSync() {
    if (!deviceSettings.syncCode) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow({silent: true}), 1000);
  }
  function setStorageMode(mode) {
    deviceSettings.storageMode = ['local', 'file', 'synology'].includes(mode) ? mode : 'local';
    saveDeviceSettings();
    renderSettings();
    renderGame();
    if (mode === 'synology') refreshServerCatalog({silent: true});
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
  }
  function wrapCanvasText(context, text, maxWidth) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  async function createScorecardPng(record) {
    const width = 1400;
    const margin = 70;
    const tableRows = [...upperCategories, {id: '__upper', label: 'Summe oben'}, {id: '__bonus', label: `Bonus (${BONUS_POINTS})`}, ...lowerCategories, {id: '__total', label: 'Gesamtsumme'}];
    const imageHeight = record.imageData ? 360 : 0;
    const noteLinesEstimate = record.note ? Math.max(1, Math.ceil(record.note.length / 75)) : 0;
    const height = 310 + imageHeight + (record.note ? 80 + noteLinesEstimate * 34 : 0) + 70 + tableRows.length * 56 + 120;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f3f5f9';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    roundedRect(context, 34, 34, width - 68, height - 68, 34);
    context.fill();
    let y = 92;
    context.fillStyle = '#0b57d0';
    context.font = '900 34px -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillText('YATZY', margin, y);
    context.fillStyle = '#6b7280';
    context.font = '600 26px -apple-system, BlinkMacSystemFont, sans-serif';
    context.textAlign = 'right';
    context.fillText(formatDate(record.finishedAt), width - margin, y);
    context.textAlign = 'left';
    y += 70;
    context.fillStyle = '#111827';
    context.font = '900 54px -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillText((record.title || 'Yatzy-Runde').slice(0, 42), margin, y);
    y += 54;
    context.font = '800 34px -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillStyle = '#0b57d0';
    context.fillText(winnerLabel(record), margin, y);
    context.textAlign = 'right';
    context.fillStyle = '#111827';
    context.fillText(scoreLine(record), width - margin, y);
    context.textAlign = 'left';
    y += 58;
    context.font = '600 24px -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillStyle = '#6b7280';
    context.fillText(`Startspieler: ${record.players[record.starter]}`, margin, y);
    y += 42;
    if (record.imageData) {
      try {
        const image = await loadImage(record.imageData);
        const targetX = margin, targetY = y, targetWidth = width - margin * 2, targetHeight = 330;
        roundedRect(context, targetX, targetY, targetWidth, targetHeight, 24);
        context.save();
        context.clip();
        const scale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
        context.drawImage(image, targetX + (targetWidth - drawWidth) / 2, targetY + (targetHeight - drawHeight) / 2, drawWidth, drawHeight);
        context.restore();
        y += targetHeight + 34;
      } catch {}
    }
    if (record.note) {
      context.fillStyle = '#eef3ff';
      context.font = '600 25px -apple-system, BlinkMacSystemFont, sans-serif';
      const lines = wrapCanvasText(context, record.note, width - margin * 2 - 44);
      const boxHeight = 42 + lines.length * 34;
      roundedRect(context, margin, y, width - margin * 2, boxHeight, 20);
      context.fill();
      context.fillStyle = '#334155';
      lines.forEach((line, index) => context.fillText(line, margin + 22, y + 36 + index * 34));
      y += boxHeight + 34;
    }
    const tableX = margin;
    const tableWidth = width - margin * 2;
    const categoryWidth = 410;
    const playerWidth = (tableWidth - categoryWidth) / record.players.length;
    context.fillStyle = '#0b57d0';
    roundedRect(context, tableX, y, tableWidth, 62, 18);
    context.fill();
    context.fillStyle = '#ffffff';
    context.font = '800 24px -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillText('Kategorie', tableX + 22, y + 40);
    record.players.forEach((name, index) => {
      context.textAlign = 'center';
      context.fillText(name.slice(0, 20), tableX + categoryWidth + playerWidth * index + playerWidth / 2, y + 40);
    });
    context.textAlign = 'left';
    y += 62;
    tableRows.forEach((row, rowIndex) => {
      const strong = row.id.startsWith('__');
      context.fillStyle = strong ? '#eef3ff' : rowIndex % 2 ? '#ffffff' : '#f8fafc';
      context.fillRect(tableX, y, tableWidth, 56);
      context.strokeStyle = '#dbe1ea';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(tableX, y + 56);
      context.lineTo(tableX + tableWidth, y + 56);
      context.stroke();
      context.fillStyle = strong ? '#0b57d0' : '#334155';
      context.font = `${strong ? '800' : '600'} 23px -apple-system, BlinkMacSystemFont, sans-serif`;
      context.fillText(row.label, tableX + 22, y + 36);
      record.players.forEach((_, index) => {
        let value = 0;
        if (row.id === '__upper') value = record.totals[index].upper;
        else if (row.id === '__bonus') value = record.totals[index].bonus;
        else if (row.id === '__total') value = record.totals[index].total;
        else value = Number(record.scores[index]?.[row.id] || 0);
        context.textAlign = 'center';
        context.fillStyle = strong ? '#0b57d0' : '#111827';
        context.font = `${strong ? '900' : '700'} 24px -apple-system, BlinkMacSystemFont, sans-serif`;
        context.fillText(String(value), tableX + categoryWidth + playerWidth * index + playerWidth / 2, y + 36);
      });
      context.textAlign = 'left';
      y += 56;
    });
    context.fillStyle = '#6b7280';
    context.font = '600 21px -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillText(`Yatzy Duell ${APP_VERSION} · Bonus ${BONUS_POINTS} ab ${BONUS_LIMIT}`, margin, height - 72);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }
  async function shareRecordAsPng(record) {
    try {
      toast('PNG wird erstellt …');
      const blob = await createScorecardPng(record);
      if (!blob) throw new Error('PNG konnte nicht erstellt werden');
      const slug = (record.title || 'yatzy-spielblatt').toLocaleLowerCase('de-CH').replace(/[^a-z0-9äöü_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'yatzy-spielblatt';
      const filename = `${slug}-${new Date(record.finishedAt).toISOString().slice(0, 10)}.png`;
      const file = new File([blob], filename, {type: 'image/png'});
      if (navigator.canShare?.({files: [file]})) {
        await navigator.share({title: record.title || 'Yatzy Spielblatt', text: winnerLabel(record), files: [file]});
      } else downloadFile(file, filename);
      toast('Spielblatt bereitgestellt');
    } catch (error) {
      if (error?.name !== 'AbortError') toast(error.message || 'PNG konnte nicht geteilt werden');
    }
  }
  function shareCurrent() {
    const record = state.current.completed ? state.history.find(item => item.id === state.current.historyId) : recordFromCurrent();
    if (record) shareRecordAsPng(record);
  }
  function shareHistoryDetail() {
    const record = state.history.find(item => item.id === activeHistoryId);
    if (record) shareRecordAsPng(record);
  }

  function showConfirm(title, text, okLabel, action, icon = '⚠️') {
    confirmAction = action;
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmOk').textContent = okLabel;
    $('confirmIcon').textContent = icon;
    $('confirmDialog').showModal();
  }
  function deleteAllData() {
    showConfirm('Alle lokalen Daten löschen?', 'Diese Aktion löscht aktuelle Runde, Historie, Profile, Bilder und Statistiken auf diesem Gerät. Serverdaten bleiben bestehen.', 'Alles löschen', () => {
      state = makeNewState();
      saveState();
      renderAll();
      activatePage('game');
      toast('Lokale Daten gelöscht');
    });
  }
  function undo() {
    if (!state.undo.length) return;
    if (state.current.completed) {
      achievementQueue = [];
      achievementQueueDone = null;
      closeAchievementOverlay();
      state.history = state.history.filter(item => item.id !== state.current.historyId);
      state.current.completed = false;
      state.current.historyId = null;
      if ($('summaryDialog').open) $('summaryDialog').close();
      activeSummaryId = null;
      pendingSummaryImage = '';
    }
    const previous = state.undo.pop();
    state.current.scores = previous.scores;
    state.current.yatzyFaces = Array.isArray(previous.yatzyFaces) ? previous.yatzyFaces : emptyYatzyFaces(activeCount());
    markChanged();
    renderAll();
    toast('Letzte Eingabe rückgängig gemacht');
  }
  function setGameMode(enabled) {
    deviceSettings.gameMode = Boolean(enabled);
    saveDeviceSettings();
    document.body.classList.toggle('game-mode', deviceSettings.gameMode);
    document.documentElement.style.setProperty('--gm-row', 'clamp(23px, calc((100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 47px) / 21.15), 40px)');
    if (!enabled) window.scrollTo({top: 0, behavior: 'auto'});
    lastAutoScrolledPlayer = '';
    renderGame();
    scrollActivePlayerIntoView(currentPlayerIndex(), {force: true});
  }
  function activatePage(page) {
    if (deviceSettings.gameMode && page !== 'game') setGameMode(false);
    document.querySelectorAll('.page').forEach(element => element.classList.toggle('active', element.dataset.page === page));
    document.querySelectorAll('.nav-button').forEach(element => element.classList.toggle('active', element.dataset.target === page));
    window.scrollTo({top: 0, behavior: 'smooth'});
    if (page === 'stats') renderStats();
    if (page === 'badges') renderBadges();
    if (page === 'history') renderHistory();
    if (page === 'settings') renderSettings();
  }
  function renderAll() { renderGame(); renderStats(); renderBadges(); renderHistory(); renderSettings(); }
  function formatDate(value) {
    try { return new Intl.DateTimeFormat('de-CH', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)); }
    catch { return value || '–'; }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400);
  }
  function setStatusDot(id, colour) {
    const dot = $(id);
    if (!dot) return;
    dot.style.background = colour;
    dot.style.boxShadow = `0 0 0 4px color-mix(in srgb, ${colour} 13%, transparent)`;
  }

  function updateWakeLockStatus(text, colour = 'var(--muted)') { $('wakeLockStatusText').textContent = text; setStatusDot('wakeLockStatusDot', colour); }
  function refreshWakeLockStatus() {
    if (state.settings.keepScreenAwake === false) { updateWakeLockStatus('Ausgeschaltet · normale Bildschirmsperre'); return; }
    if (!window.isSecureContext) { updateWakeLockStatus('Nicht aktiv · HTTPS erforderlich', 'var(--warning)'); return; }
    if (!('wakeLock' in navigator)) { updateWakeLockStatus('Auf diesem Gerät nicht unterstützt', 'var(--warning)'); return; }
    if (wakeLockSentinel && !wakeLockSentinel.released) { updateWakeLockStatus('Aktiv · Bildschirm bleibt eingeschaltet', 'var(--success)'); return; }
    if (document.visibilityState !== 'visible') { updateWakeLockStatus('Pausiert · App ist im Hintergrund'); return; }
    updateWakeLockStatus('Bereit · wird automatisch aktiviert', 'var(--accent)');
  }
  async function requestWakeLock({userInitiated = false} = {}) {
    if (state.settings.keepScreenAwake === false || !window.isSecureContext || !('wakeLock' in navigator) || document.visibilityState !== 'visible') { refreshWakeLockStatus(); return false; }
    if (wakeLockSentinel && !wakeLockSentinel.released) { refreshWakeLockStatus(); return true; }
    if (wakeLockPending) return false;
    wakeLockPending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      wakeLockSentinel = lock;
      lock.addEventListener('release', () => { if (wakeLockSentinel === lock) wakeLockSentinel = null; refreshWakeLockStatus(); });
      refreshWakeLockStatus();
      return true;
    } catch (error) {
      wakeLockSentinel = null;
      updateWakeLockStatus(error?.name === 'NotAllowedError' ? 'Bereit · einmal in die App tippen' : 'Konnte nicht aktiviert werden', 'var(--warning)');
      if (userInitiated) toast('Bildschirm konnte nicht wach gehalten werden');
      return false;
    } finally { wakeLockPending = false; }
  }
  async function releaseWakeLock() { const lock = wakeLockSentinel; wakeLockSentinel = null; if (lock && !lock.released) try { await lock.release(); } catch {} refreshWakeLockStatus(); }
  function setActiveColumnMode(value) {
    const mode = ['auto', 'always', 'off'].includes(value) ? value : 'auto';
    state.settings.activeColumnMode = mode;
    lastAutoScrolledPlayer = '';
    markChanged({settings: true});
    renderGame();
    renderSettings();
    scrollActivePlayerIntoView(currentPlayerIndex(), {force: true});
    toast(mode === 'always' ? 'Aktive Spalte wird immer hervorgehoben' : mode === 'off' ? 'Spaltenhervorhebung ausgeschaltet' : 'Hervorhebung ab 5 Spielern aktiv');
  }
  async function setWakeLockPreference(enabled) {
    state.settings.keepScreenAwake = Boolean(enabled);
    markChanged({settings: true});
    if (enabled) { const active = await requestWakeLock({userInitiated: true}); toast(active ? 'Bildschirm bleibt eingeschaltet' : 'Einstellung gespeichert'); }
    else { await releaseWakeLock(); toast('Normale Bildschirmsperre aktiviert'); }
    renderSettings();
  }
  function setupWakeLock() {
    refreshWakeLockStatus();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { requestWakeLock(); if (deviceSettings.storageMode === 'synology' && deviceSettings.autoSync) scheduleSync(); }
      else refreshWakeLockStatus();
    });
    window.addEventListener('pageshow', () => requestWakeLock());
    document.addEventListener('pointerdown', () => { if (state.settings.keepScreenAwake !== false && (!wakeLockSentinel || wakeLockSentinel.released)) requestWakeLock(); }, {passive: true});
    requestWakeLock();
  }

  function updateAppStatus(text, online = true) { $('appStatusText').textContent = text; setStatusDot('appStatusDot', online ? 'var(--success)' : 'var(--warning)'); }
  async function setupPwa() {
    if ($('appVersion')) $('appVersion').textContent = APP_VERSION;
    window.addEventListener('online', () => { updateAppStatus('Online · Daten lokal gespeichert', true); if (deviceSettings.storageMode === 'synology' && deviceSettings.autoSync) scheduleSync(); });
    window.addEventListener('offline', () => updateAppStatus('Offline · App bleibt lokal nutzbar', false));
    updateAppStatus(navigator.onLine ? 'Online · Daten lokal gespeichert' : 'Offline · App bleibt lokal nutzbar', navigator.onLine);
    try { await navigator.storage?.persist?.(); } catch {}
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', {scope: './'});
      updateAppStatus(navigator.onLine ? 'Installierbar und offline bereit' : 'Offline · App bleibt nutzbar', navigator.onLine);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) toast('Neue Version bereit – App neu öffnen'); });
      });
    } catch { updateAppStatus('Web-App bereit · Offline-Modus braucht HTTPS', navigator.onLine); }
  }
  function dismissSplash() {
    const splash = $('splashScreen');
    if (!splash) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 650;
    setTimeout(() => { splash.classList.add('is-hidden'); setTimeout(() => splash.remove(), 350); }, delay);
  }

  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => activatePage(button.dataset.target)));
  document.addEventListener('click', event => { if (event.target.closest('#openBadgesPageButton')) activatePage('badges'); });
  $('quickNewButton').addEventListener('click', openNewGameDialog);
  $('newGameButton').addEventListener('click', openNewGameDialog);
  $('summaryNewGameButton').addEventListener('click', () => { saveSummaryMemory({silent: true}); $('summaryDialog').close(); activeSummaryId = null; openNewGameDialog(); });
  $('summaryCloseButton').addEventListener('click', () => { saveSummaryMemory({silent: true}); $('summaryDialog').close(); activeSummaryId = null; });
  $('summaryMemorySave').addEventListener('click', () => saveSummaryMemory());
  $('summaryMemoryImage').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) handleSummaryMemoryImage(file); });
  $('summaryMemoryRemoveImage').addEventListener('click', () => { pendingSummaryImage = ''; $('summaryMemoryImage').value = ''; renderSummaryMemoryImage(); $('summaryMemoryStatus').textContent = 'Bild wird beim Speichern entfernt.'; });
  $('startGameButton').addEventListener('click', startNewGame);
  $('quickAddProfileButton').addEventListener('click', () => promptAddProfile(true));
  $('newGameImage').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) handleNewGameImage(file); });
  $('removeNewGameImageButton').addEventListener('click', () => { pendingGameImage = ''; $('newGameImage').value = ''; renderPendingImage(); });
  $('saveScoreButton').addEventListener('click', () => { if ($('scoreInput').value !== '') setScore($('scoreInput').value); });
  $('zeroScoreButton').addEventListener('click', () => setScore(0));
  $('clearScoreButton').addEventListener('click', () => { $('scoreDialog').close(); activeEdit = null; });
  $('undoButton').addEventListener('click', undo);
  $('shareButton').addEventListener('click', shareCurrent);
  $('manualSyncButton').addEventListener('click', () => syncNow());
  $('reopenButton').addEventListener('click', reopenCurrentGame);
  $('enterGameModeButton').addEventListener('click', () => setGameMode(true));
  $('exitGameModeButton').addEventListener('click', () => setGameMode(false));
  $('addProfileButton').addEventListener('click', () => promptAddProfile(false));
  document.querySelectorAll('[data-stats-view]').forEach(button => button.addEventListener('click', () => { deviceSettings.statsView = button.dataset.statsView; saveDeviceSettings(); renderStats(); }));
  $('statsAreaRangeSelect').addEventListener('change', event => { deviceSettings.statsAreaRange = event.target.value; saveDeviceSettings(); renderStats(); });
  $('statsProfileSelect').addEventListener('change', event => { deviceSettings.statsProfileId = event.target.value; saveDeviceSettings(); renderStats(); });
  $('badgesProfileSelect').addEventListener('change', event => { deviceSettings.badgeProfileId = event.target.value; saveDeviceSettings(); renderBadges(); });
  document.querySelectorAll('[data-badge-filter]').forEach(button => button.addEventListener('click', () => { deviceSettings.badgeFilter = button.dataset.badgeFilter; saveDeviceSettings(); renderBadges(); }));
  $('activeColumnModeSelect').addEventListener('change', event => setActiveColumnMode(event.target.value));
  $('keepScreenAwakeToggle').addEventListener('change', event => setWakeLockPreference(event.target.checked));
  $('storageModeSelect').addEventListener('change', event => setStorageMode(event.target.value));
  $('exportButton').addEventListener('click', exportData);
  $('importButton').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importData(file); });
  ['syncUrl', 'cloudflareClientId', 'cloudflareClientSecret'].forEach(id => $(id).addEventListener('change', readSyncForm));
  $('syncCodeSelect').addEventListener('change', event => switchSyncArea(event.target.value));
  $('refreshServerCatalogButton').addEventListener('click', () => refreshServerCatalog());
  $('addSyncCodeButton').addEventListener('click', addSyncCode);
  $('renameSyncCodeButton').addEventListener('click', renameSyncCode);
  $('removeSyncCodeButton').addEventListener('click', removeSyncCode);
  $('autoSyncToggle').addEventListener('change', () => { readSyncForm(); if (deviceSettings.autoSync) scheduleSync(); });
  $('testSyncButton').addEventListener('click', testSync);
  $('syncNowButton').addEventListener('click', () => syncNow());
  $('downloadServerButton').addEventListener('click', () => showConfirm('Serverdaten laden?', `Die aktuellen lokalen Daten werden vollständig durch den Serverstand von «${deviceSettings.syncCode || 'kein Code'}» ersetzt.`, 'Serverdaten laden', () => downloadServerToLocal(), '☁️'));
  $('uploadLocalButton').addEventListener('click', () => showConfirm('Lokale Daten hochladen?', `Der Serverstand von «${deviceSettings.syncCode || 'kein Code'}» wird vollständig durch die Daten dieses Geräts ersetzt.`, 'Hochladen', () => uploadLocalToServer(), '⬆️'));
  $('deleteServerAreaButton').addEventListener('click', deleteServerArea);
  $('resetServerButton').addEventListener('click', resetServer);
  const closeImportMapping = () => { pendingImport = null; $('importMappingDialog').close(); };
  $('importMappingClose').addEventListener('click', closeImportMapping);
  $('importMappingCancel').addEventListener('click', closeImportMapping);
  $('importAutoMatchButton').addEventListener('click', () => setImportMappingMode('auto'));
  $('importAllNewButton').addEventListener('click', () => setImportMappingMode('new'));
  $('importMappingApply').addEventListener('click', applyImportMapping);
  $('deleteAllButton').addEventListener('click', deleteAllData);
  $('historyDetailClose').addEventListener('click', () => $('historyDialog').close());
  $('openBadgeImageManagerButton').addEventListener('click', openBadgeImageManager);
  $('badgeImageManagerClose').addEventListener('click', () => $('badgeImageManagerDialog').close());
  $('badgeImageManagerDone').addEventListener('click', () => $('badgeImageManagerDialog').close());
  $('resetAllBadgeImagesButton').addEventListener('click', resetAllBadgeImages);
  $('badgeImageManagerGrid').addEventListener('click', event => {
    const change = event.target.closest('[data-change-badge-image]');
    if (change) { pendingBadgeImageKey = change.dataset.changeBadgeImage; $('badgeImageFileInput').click(); return; }
    const reset = event.target.closest('[data-reset-badge-image]');
    if (reset) resetBadgeImage(reset.dataset.resetBadgeImage);
  });
  $('badgeImageFileInput').addEventListener('change', event => {
    const file = event.target.files?.[0];
    const key = pendingBadgeImageKey;
    event.target.value = '';
    pendingBadgeImageKey = '';
    if (file && key) openBadgeCropEditor(key, file);
  });
  $('badgeImageManagerDialog').addEventListener('click', event => { if (event.target === $('badgeImageManagerDialog')) $('badgeImageManagerDialog').close(); });
  $('badgeCropCancel').addEventListener('click', () => closeBadgeCropEditor({reopenManager:true}));
  $('badgeCropClose').addEventListener('click', () => closeBadgeCropEditor({reopenManager:true}));
  $('badgeCropSave').addEventListener('click', saveBadgeCropImage);
  $('badgeCropReset').addEventListener('click', resetBadgeCrop);
  $('badgeCropZoomOut').addEventListener('click', () => setBadgeCropZoom((badgeCropState?.zoom || 1) - .1));
  $('badgeCropZoomIn').addEventListener('click', () => setBadgeCropZoom((badgeCropState?.zoom || 1) + .1));
  $('badgeCropZoom').addEventListener('input', event => setBadgeCropZoom(Number(event.target.value) / 100));
  $('badgeCropDialog').addEventListener('cancel', event => { event.preventDefault(); closeBadgeCropEditor({reopenManager:true}); });
  $('badgeCropDialog').addEventListener('click', event => { if (event.target === $('badgeCropDialog')) closeBadgeCropEditor({reopenManager:true}); });
  $('badgeCropCanvas').addEventListener('wheel', event => {
    if (!badgeCropState) return;
    event.preventDefault();
    const point = badgeCropPoint(event);
    setBadgeCropZoom(badgeCropState.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08), point.x, point.y);
  }, {passive:false});
  $('badgeCropCanvas').addEventListener('pointerdown', event => {
    if (!badgeCropState) return;
    const canvas = $('badgeCropCanvas');
    canvas.setPointerCapture?.(event.pointerId);
    badgeCropPointers.set(event.pointerId, badgeCropPoint(event));
    if (badgeCropPointers.size === 2) {
      const points = [...badgeCropPointers.values()];
      badgeCropGesture = {
        distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        center: {x:(points[0].x + points[1].x) / 2, y:(points[0].y + points[1].y) / 2}
      };
    }
  });
  $('badgeCropCanvas').addEventListener('pointermove', event => {
    if (!badgeCropState || !badgeCropPointers.has(event.pointerId)) return;
    const previous = badgeCropPointers.get(event.pointerId);
    const current = badgeCropPoint(event);
    badgeCropPointers.set(event.pointerId, current);
    if (badgeCropPointers.size === 1) {
      badgeCropState.x += current.x - previous.x;
      badgeCropState.y += current.y - previous.y;
      renderBadgeCrop();
      return;
    }
    if (badgeCropPointers.size === 2) {
      const points = [...badgeCropPointers.values()];
      const distance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
      const center = {x:(points[0].x + points[1].x) / 2, y:(points[0].y + points[1].y) / 2};
      if (badgeCropGesture) {
        badgeCropState.x += center.x - badgeCropGesture.center.x;
        badgeCropState.y += center.y - badgeCropGesture.center.y;
        setBadgeCropZoom(badgeCropState.zoom * distance / Math.max(1, badgeCropGesture.distance), center.x, center.y);
      }
      badgeCropGesture = {distance, center};
    }
  });
  const endBadgeCropPointer = event => {
    badgeCropPointers.delete(event.pointerId);
    badgeCropGesture = null;
  };
  $('badgeCropCanvas').addEventListener('pointerup', endBadgeCropPointer);
  $('badgeCropCanvas').addEventListener('pointercancel', endBadgeCropPointer);

  $('badgeDetailClose').addEventListener('click', () => $('badgeDetailDialog').close());
  $('badgeDetailDone').addEventListener('click', () => $('badgeDetailDialog').close());
  $('badgeDetailDialog').addEventListener('click', event => { if (event.target === $('badgeDetailDialog')) $('badgeDetailDialog').close(); });
  $('photoDialogClose').addEventListener('click', closePhotoViewer);
  $('photoDialog').addEventListener('click', event => { if (event.target === $('photoDialog')) closePhotoViewer(); });
  $('photoDialog').addEventListener('close', () => { $('photoDialogImage').removeAttribute('src'); });
  $('historyDetailShare').addEventListener('click', shareHistoryDetail);
  $('yatzyFaceDialog').addEventListener('cancel', event => { event.preventDefault(); closeYatzyFaceDialog(null); });
  $('yatzyFaceClose').addEventListener('click', () => closeYatzyFaceDialog(null));
  $('yatzyFaceCancel').addEventListener('click', () => closeYatzyFaceDialog(null));
  $('yatzyFaceGrid').querySelectorAll('[data-yatzy-face]').forEach(button => button.addEventListener('click', () => closeYatzyFaceDialog(Number(button.dataset.yatzyFace))));
  $('achievementOverlay').addEventListener('click', presentNextAchievement);
  $('achievementPopup').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); presentNextAchievement(); } });
  $('confirmCancel').addEventListener('click', () => { confirmAction = null; $('confirmDialog').close(); });
  $('confirmOk').addEventListener('click', () => { const action = confirmAction; confirmAction = null; $('confirmDialog').close(); if (action) action(); });
  document.querySelectorAll('input[name="playerCount"]').forEach(input => input.addEventListener('change', refreshNewGameDialog));
  document.querySelectorAll('.new-profile').forEach(input => input.addEventListener('change', refreshNewGameDialog));
  window.addEventListener('resize', () => {
    lastAutoScrolledPlayer = '';
    scrollActivePlayerIntoView(currentPlayerIndex(), {force: true});
  }, {passive: true});

  renderAll();
  setGameMode(deviceSettings.gameMode);
  setupPwa();
  setupWakeLock();
  dismissSplash();
  if (deviceSettings.storageMode === 'synology' && deviceSettings.autoSync && deviceSettings.syncCode) setTimeout(() => syncNow({silent: true}), 1200);
  else if (deviceSettings.storageMode === 'synology') setTimeout(() => refreshServerCatalog({silent: true}), 800);
})();
