const DB_NAME = "curiousstride-reflections";
const DB_VERSION = 1;
const REFLECTIONS = "reflections";
const FINALS = "finalReflections";
const PREFERENCES = "preferences";

let databasePromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was cancelled."));
  });
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("This browser does not support IndexedDB."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(REFLECTIONS)) {
          const store = db.createObjectStore(REFLECTIONS, { keyPath: "key" });
          store.createIndex("byUserChallenge", "userChallenge", { unique: false });
          store.createIndex("byUpdatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(FINALS)) {
          db.createObjectStore(FINALS, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(PREFERENCES)) {
          db.createObjectStore(PREFERENCES, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open local reflection storage."));
      request.onblocked = () => reject(new Error("Local storage is blocked by another open CuriousStride tab."));
    });
  }
  return databasePromise;
}

function reflectionKey(userId, challengeSlug, dayNumber) {
  return `${userId}::${challengeSlug}::${Number(dayNumber)}`;
}

function userChallengeKey(userId, challengeSlug) {
  return `${userId}::${challengeSlug}`;
}

export async function getReflection(userId, challengeSlug, dayNumber) {
  const db = await openDatabase();
  const transaction = db.transaction(REFLECTIONS, "readonly");
  return requestToPromise(transaction.objectStore(REFLECTIONS).get(reflectionKey(userId, challengeSlug, dayNumber)));
}

export async function getAllReflections(userId, challengeSlug) {
  const db = await openDatabase();
  const transaction = db.transaction(REFLECTIONS, "readonly");
  const index = transaction.objectStore(REFLECTIONS).index("byUserChallenge");
  const records = await requestToPromise(index.getAll(userChallengeKey(userId, challengeSlug)));
  return records.sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber));
}

export async function saveReflection(record) {
  const dayNumber = Number(record?.dayNumber);
  if (!record?.userId || !record?.challengeSlug || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
    throw new Error("A user, challenge and valid day are required to save a reflection.");
  }
  if (String(record.response || "").length > 100000) {
    throw new Error("This reflection is too large to save. Shorten it or export a copy before continuing.");
  }
  const db = await openDatabase();
  const transaction = db.transaction(REFLECTIONS, "readwrite");
  const store = transaction.objectStore(REFLECTIONS);
  const existing = await requestToPromise(store.get(reflectionKey(record.userId, record.challengeSlug, record.dayNumber)));
  const now = new Date().toISOString();
  const saved = {
    ...existing,
    ...record,
    key: reflectionKey(record.userId, record.challengeSlug, record.dayNumber),
    userChallenge: userChallengeKey(record.userId, record.challengeSlug),
    createdAt: existing?.createdAt || record.createdAt || now,
    updatedAt: record.updatedAt || now
  };
  store.put(saved);
  await transactionDone(transaction);
  return saved;
}

export async function saveManyReflections(records = []) {
  if (!records.length) return [];
  const db = await openDatabase();
  const transaction = db.transaction(REFLECTIONS, "readwrite");
  const store = transaction.objectStore(REFLECTIONS);
  const saved = [];
  for (const record of records) {
    const dayNumber = Number(record?.dayNumber);
    if (!record?.userId || !record?.challengeSlug || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) continue;
    if (String(record.response || "").length > 100000) continue;
    const existing = await requestToPromise(store.get(reflectionKey(record.userId, record.challengeSlug, record.dayNumber)));
    const now = new Date().toISOString();
    const merged = {
      ...existing,
      ...record,
      key: reflectionKey(record.userId, record.challengeSlug, record.dayNumber),
      userChallenge: userChallengeKey(record.userId, record.challengeSlug),
      createdAt: existing?.createdAt || record.createdAt || now,
      updatedAt: record.updatedAt || now
    };
    store.put(merged);
    saved.push(merged);
  }
  await transactionDone(transaction);
  return saved;
}

export async function deleteReflection(userId, challengeSlug, dayNumber) {
  const db = await openDatabase();
  const transaction = db.transaction(REFLECTIONS, "readwrite");
  transaction.objectStore(REFLECTIONS).delete(reflectionKey(userId, challengeSlug, dayNumber));
  await transactionDone(transaction);
}

export async function getFinalReflections(userId, challengeSlug) {
  const db = await openDatabase();
  const transaction = db.transaction(FINALS, "readonly");
  return requestToPromise(transaction.objectStore(FINALS).get(userChallengeKey(userId, challengeSlug)));
}

export async function saveFinalReflections(userId, challengeSlug, answers) {
  const db = await openDatabase();
  const transaction = db.transaction(FINALS, "readwrite");
  const record = {
    key: userChallengeKey(userId, challengeSlug),
    userId,
    challengeSlug,
    answers: { ...answers },
    updatedAt: new Date().toISOString()
  };
  transaction.objectStore(FINALS).put(record);
  await transactionDone(transaction);
  return record;
}

export async function getPreference(key, fallback = null) {
  const db = await openDatabase();
  const transaction = db.transaction(PREFERENCES, "readonly");
  const result = await requestToPromise(transaction.objectStore(PREFERENCES).get(key));
  return result?.value ?? fallback;
}

export async function setPreference(key, value) {
  const db = await openDatabase();
  const transaction = db.transaction(PREFERENCES, "readwrite");
  transaction.objectStore(PREFERENCES).put({ key, value, updatedAt: new Date().toISOString() });
  await transactionDone(transaction);
  return value;
}

export async function clearUserData(userId, challengeSlug) {
  const db = await openDatabase();
  const transaction = db.transaction([REFLECTIONS, FINALS], "readwrite");
  const reflectionStore = transaction.objectStore(REFLECTIONS);
  const index = reflectionStore.index("byUserChallenge");
  const keys = await requestToPromise(index.getAllKeys(userChallengeKey(userId, challengeSlug)));
  keys.forEach((key) => reflectionStore.delete(key));
  transaction.objectStore(FINALS).delete(userChallengeKey(userId, challengeSlug));
  await transactionDone(transaction);
}

export async function buildBackup(userId, challengeSlug, profile = {}) {
  const [reflections, finals] = await Promise.all([
    getAllReflections(userId, challengeSlug),
    getFinalReflections(userId, challengeSlug)
  ]);
  return {
    format: "curiousstride-backup",
    version: 2,
    exportedAt: new Date().toISOString(),
    challengeSlug,
    participant: {
      id: userId,
      fullName: profile.fullName || "",
      email: profile.email || "",
      challengeStartDate: profile.challengeStartDate || "",
      timezone: profile.timezone || "UTC"
    },
    reflections: reflections.map(({ key, userChallenge, ...record }) => record),
    finalReflections: finals?.answers || {},
    finalReflectionsUpdatedAt: finals?.updatedAt || ""
  };
}

export async function restoreBackup(backup, userId, challengeSlug, { overwrite = false } = {}) {
  if (backup?.format !== "curiousstride-backup" || !Array.isArray(backup.reflections)) {
    throw new Error("This file is not a valid CuriousStride backup.");
  }
  if (backup.challengeSlug && backup.challengeSlug !== challengeSlug) {
    throw new Error("This backup belongs to a different CuriousStride challenge.");
  }

  const [existing, existingFinals] = await Promise.all([
    getAllReflections(userId, challengeSlug),
    getFinalReflections(userId, challengeSlug)
  ]);
  const byDay = new Map(existing.map((record) => [Number(record.dayNumber), record]));
  const records = [];

  for (const raw of backup.reflections.slice(0, 30)) {
    const dayNumber = Number(raw?.dayNumber);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) continue;
    const response = typeof raw.response === "string" ? raw.response.slice(0, 100000) : "";
    const current = byDay.get(dayNumber);
    const incomingDate = new Date(raw.updatedAt || raw.createdAt || backup.exportedAt || 0);
    const currentDate = new Date(current?.updatedAt || current?.createdAt || 0);
    const incomingIsNewer = !current || incomingDate > currentDate;
    if (!overwrite && current && !incomingIsNewer) continue;
    records.push({
      ...raw,
      response,
      userId,
      challengeSlug,
      dayNumber,
      completed: Boolean(raw.completed)
    });
  }

  await saveManyReflections(records);

  if (backup.finalReflections && typeof backup.finalReflections === "object") {
    const incomingFinalDate = new Date(backup.finalReflectionsUpdatedAt || backup.exportedAt || 0);
    const existingFinalDate = new Date(existingFinals?.updatedAt || 0);
    if (overwrite || !existingFinals || incomingFinalDate > existingFinalDate) {
      const answers = Object.fromEntries(
        Object.entries(backup.finalReflections)
          .slice(0, 10)
          .map(([key, value]) => [key, String(value || "").slice(0, 100000)])
      );
      await saveFinalReflections(userId, challengeSlug, answers);
    }
  }
  return records.length;
}

export function localDraftKey(userId, challengeSlug, dayNumber) {
  return `curiousstride-draft::${userId}::${challengeSlug}::${Number(dayNumber)}`;
}

export function saveEmergencyDraft(userId, challengeSlug, dayNumber, payload) {
  try {
    localStorage.setItem(
      localDraftKey(userId, challengeSlug, dayNumber),
      JSON.stringify({ ...payload, updatedAt: new Date().toISOString() })
    );
    return true;
  } catch (error) {
    console.warn("Emergency draft could not be stored:", error);
    return false;
  }
}

export function readEmergencyDraft(userId, challengeSlug, dayNumber) {
  const raw = localStorage.getItem(localDraftKey(userId, challengeSlug, dayNumber));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearEmergencyDraft(userId, challengeSlug, dayNumber) {
  try {
    localStorage.removeItem(localDraftKey(userId, challengeSlug, dayNumber));
  } catch (error) {
    console.warn("Emergency draft could not be cleared:", error);
  }
}
