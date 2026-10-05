// cloud-sync.js
// INTZ v10.1 – Offline-first toveis synkronisering

function activeUser() {
  return (
    localStorage.getItem("active_user") ||
    "default"
  );
}

function nsKey(key) {
  return `u:${activeUser()}:${key}`;
}

function getNS(key, fallback) {
  try {
    const current =
      localStorage.getItem(nsKey(key));

    if (current != null) {
      return JSON.parse(current);
    }

    const legacy =
      localStorage.getItem(key);

    return legacy != null
      ? JSON.parse(legacy)
      : fallback;
  } catch (error) {
    console.warn(
      "[INTZ] Kunne ikke lese lokal lagring:",
      key,
      error
    );

    return fallback;
  }
}

function setNS(key, value) {
  localStorage.setItem(
    nsKey(key),
    JSON.stringify(value)
  );
}

function removeMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(removeMetadata);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const result = {};

    for (
      const [key, child] of
      Object.entries(value)
    ) {
      if (
        key === "_cloud_id" ||
        key === "_sync_status" ||
        key === "_sync_hash" ||
        key === "_cloud_synced_at"
      ) {
        continue;
      }

      result[key] = removeMetadata(child);
    }

    return result;
  }

  return value;
}

function contentHash(item) {
  const content = removeMetadata(item);

  return JSON.stringify(content);
}

function createUuid(prefix = "intz") {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

function parseTime(value) {
  const parsed = Date.parse(value || "");

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function ensureMetadata(item, prefix) {
  const now = new Date().toISOString();

  const normalized = {
    ...item,

    _local_id:
      item?._local_id ||
      item?.id ||
      createUuid(prefix),

    _schema_version:
      Number(item?._schema_version || 1),

    _updated_at:
      item?._updated_at || now,

    _deleted_at:
      item?._deleted_at || null,

    _sync_status:
      item?._sync_status || "pending"
  };

  const newHash = contentHash(normalized);

  if (
    normalized._sync_hash &&
    normalized._sync_hash !== newHash
  ) {
    normalized._updated_at = now;
    normalized._sync_status = "pending";
  }

  normalized._sync_hash =
    contentHash(normalized);

  return normalized;
}

function migrateCollection(
  storageKey,
  prefix
) {
  const source = getNS(storageKey, []);

  if (!Array.isArray(source)) {
    setNS(storageKey, []);
    return [];
  }

  let changed = false;

  const migrated = source.map(item => {
    const normalized =
      ensureMetadata(item || {}, prefix);

    if (
      normalized._local_id !==
        item?._local_id ||
      normalized._schema_version !==
        item?._schema_version ||
      normalized._updated_at !==
        item?._updated_at ||
      normalized._sync_hash !==
        item?._sync_hash
    ) {
      changed = true;
    }

    return normalized;
  });

  if (changed) {
    setNS(storageKey, migrated);
  }

  return migrated;
}

function knownKey(collectionName) {
  return `cloud_known_${collectionName}`;
}

function getKnownIds(collectionName) {
  const value = getNS(
    knownKey(collectionName),
    []
  );

  return Array.isArray(value)
    ? value
    : [];
}

function setKnownIds(
  collectionName,
  ids
) {
  setNS(
    knownKey(collectionName),
    Array.from(new Set(ids))
  );
}

function deletionLedgerKey(
  collectionName
) {
  return `cloud_deleted_${collectionName}`;
}

function getDeletionLedger(
  collectionName
) {
  const value = getNS(
    deletionLedgerKey(collectionName),
    []
  );

  return Array.isArray(value)
    ? value
    : [];
}

function setDeletionLedger(
  collectionName,
  items
) {
  setNS(
    deletionLedgerKey(collectionName),
    items
  );
}

function detectLocalDeletions(
  collectionName,
  localItems
) {
  const knownIds =
    getKnownIds(collectionName);

  const localIds = new Set(
    localItems
      .map(item => item?._local_id)
      .filter(Boolean)
  );

  const ledger =
    getDeletionLedger(collectionName);

  const ledgerIds = new Set(
    ledger
      .map(item => item?._local_id)
      .filter(Boolean)
  );

  const now =
    new Date().toISOString();

  for (const knownId of knownIds) {
    if (
      localIds.has(knownId) ||
      ledgerIds.has(knownId)
    ) {
      continue;
    }

    ledger.push({
      _local_id: knownId,
      _schema_version: 1,
      _updated_at: now,
      _deleted_at: now,
      _sync_status: "pending",
      _sync_hash: "",
      name: "Slettet"
    });
  }

  setDeletionLedger(
    collectionName,
    ledger
  );

  return ledger;
}

function pendingItems(items) {
  return items.filter(item => {
    if (!item?._local_id) {
      return false;
    }

    return (
      item._sync_status !== "synced" ||
      !item._cloud_id
    );
  });
}

function markUploaded(
  items,
  uploadedRows
) {
  const byLocalId = new Map(
    (uploadedRows || []).map(row => [
      row.local_id,
      row
    ])
  );

  return items.map(item => {
    const row =
      byLocalId.get(item._local_id);

    if (!row) {
      return item;
    }

    const updated = {
      ...item,
      _cloud_id: row.id,
      _cloud_synced_at:
        new Date().toISOString(),
      _sync_status: "synced"
    };

    updated._sync_hash =
      contentHash(updated);

    return updated;
  });
}

function markErrors(
  items,
  attemptedIds
) {
  const idSet =
    new Set(attemptedIds);

  return items.map(item => {
    if (!idSet.has(item._local_id)) {
      return item;
    }

    return {
      ...item,
      _sync_status: "error"
    };
  });
}

function normalizeCloudRow(
  row,
  prefix
) {
  const payload =
    row?.payload &&
    typeof row.payload === "object"
      ? row.payload
      : {};

  const result = ensureMetadata(
    {
      ...payload,

      _cloud_id: row.id,

      _local_id:
        row.local_id ||
        payload._local_id ||
        createUuid(prefix),

      _schema_version:
        Number(
          row.schema_version ||
          payload._schema_version ||
          1
        ),

      _updated_at:
        row.client_updated_at ||
        payload._updated_at ||
        new Date().toISOString(),

      _deleted_at:
        row.deleted_at ||
        payload._deleted_at ||
        null,

      _cloud_synced_at:
        new Date().toISOString(),

      _sync_status: "synced"
    },
    prefix
  );

  result._sync_hash =
    contentHash(result);

  return result;
}

function mergeCollections(
  localItems,
  cloudRows,
  prefix
) {
  const merged = new Map();

  for (const rawLocal of localItems) {
    const local =
      ensureMetadata(
        rawLocal,
        prefix
      );

    merged.set(
      local._local_id,
      local
    );
  }

  let downloaded = 0;
  let replaced = 0;
  let deleted = 0;

  for (const row of cloudRows || []) {
    const cloud =
      normalizeCloudRow(
        row,
        prefix
      );

    const local =
      merged.get(cloud._local_id);

    const cloudTime =
      parseTime(cloud._updated_at);

    const localTime =
      parseTime(local?._updated_at);

    if (cloud._deleted_at) {
      if (
        !local ||
        cloudTime >= localTime
      ) {
        merged.delete(
          cloud._local_id
        );

        deleted++;
      }

      continue;
    }

    if (!local) {
      merged.set(
        cloud._local_id,
        cloud
      );

      downloaded++;
      continue;
    }

    if (cloudTime > localTime) {
      merged.set(
        cloud._local_id,
        cloud
      );

      replaced++;
    }
  }

  return {
    items: Array.from(
      merged.values()
    ),
    downloaded,
    replaced,
    deleted
  };
}

async function ensureCloud() {
  if (!window.INTZSupabase) {
    throw new Error(
      "Supabase-klienten er ikke lastet."
    );
  }

  return (
    window.INTZSupabase
      .requireAuthUser()
  );
}

async function syncCollectionUp({
  collectionName,
  storageKey,
  prefix,
  upsert
}) {
  let items =
    migrateCollection(
      storageKey,
      prefix
    );

  let deletionLedger =
    detectLocalDeletions(
      collectionName,
      items
    );

  const changedItems =
    pendingItems(items);

  const changedDeletions =
    pendingItems(deletionLedger);

  const attempted = [
    ...changedItems,
    ...changedDeletions
  ];

  if (attempted.length === 0) {
    return {
      uploaded: 0,
      deleted: 0
    };
  }

  try {
    const rows = await upsert(
      attempted
    );

    items = markUploaded(
      items,
      rows
    );

    deletionLedger =
      markUploaded(
        deletionLedger,
        rows
      );

    setNS(storageKey, items);

    setDeletionLedger(
      collectionName,
      deletionLedger
    );

    const knownIds = new Set(
      getKnownIds(collectionName)
    );

    for (const item of items) {
      knownIds.add(item._local_id);
    }

    for (
      const tombstone of
      deletionLedger
    ) {
      knownIds.add(
        tombstone._local_id
      );
    }

    setKnownIds(
      collectionName,
      Array.from(knownIds)
    );

    return {
      uploaded:
        changedItems.length,
      deleted:
        changedDeletions.length
    };
  } catch (error) {
    const attemptedIds =
      attempted.map(
        item => item._local_id
      );

    items = markErrors(
      items,
      attemptedIds
    );

    deletionLedger =
      markErrors(
        deletionLedger,
        attemptedIds
      );

    setNS(storageKey, items);

    setDeletionLedger(
      collectionName,
      deletionLedger
    );

    throw error;
  }
}

async function syncUp() {
  await ensureCloud();

  const workoutResult =
    await syncCollectionUp({
      collectionName: "workouts",
      storageKey:
        "custom_workouts_v2",
      prefix: "workout",
      upsert: items =>
        window.INTZSupabase
          .upsertWorkouts(items)
    });

  const sessionResult =
    await syncCollectionUp({
      collectionName: "sessions",
      storageKey: "sessions",
      prefix: "session",
      upsert: items =>
        window.INTZSupabase
          .upsertSessions(items)
    });

  return {
    workouts_uploaded:
      workoutResult.uploaded,

    workouts_deleted:
      workoutResult.deleted,

    sessions_uploaded:
      sessionResult.uploaded,

    sessions_deleted:
      sessionResult.deleted
  };
}

async function syncDown() {
  await ensureCloud();

  const localWorkouts =
    migrateCollection(
      "custom_workouts_v2",
      "workout"
    );

  const localSessions =
    migrateCollection(
      "sessions",
      "session"
    );

  const cloudWorkouts =
    await window.INTZSupabase
      .listWorkouts();

  const cloudSessions =
    await window.INTZSupabase
      .listSessions();

  const workoutMerge =
    mergeCollections(
      localWorkouts,
      cloudWorkouts,
      "workout"
    );

  const sessionMerge =
    mergeCollections(
      localSessions,
      cloudSessions,
      "session"
    );

  setNS(
    "custom_workouts_v2",
    workoutMerge.items
  );

  setNS(
    "sessions",
    sessionMerge.items
  );

  setKnownIds(
    "workouts",
    cloudWorkouts
      .map(row => row.local_id)
      .filter(Boolean)
  );

  setKnownIds(
    "sessions",
    cloudSessions
      .map(row => row.local_id)
      .filter(Boolean)
  );

  window.dispatchEvent(
    new CustomEvent(
      "intz:datachange",
      {
        detail: {
          workouts:
            workoutMerge,
          sessions:
            sessionMerge
        }
      }
    )
  );

  return {
    workouts_downloaded:
      workoutMerge.downloaded,

    workouts_replaced:
      workoutMerge.replaced,

    workouts_deleted:
      workoutMerge.deleted,

    sessions_downloaded:
      sessionMerge.downloaded,

    sessions_replaced:
      sessionMerge.replaced,

    sessions_deleted:
      sessionMerge.deleted
  };
}

async function syncAll() {
  const uploaded =
    await syncUp();

  const downloaded =
    await syncDown();

  return {
    ...uploaded,
    ...downloaded
  };
}

function touch(item, prefix = "item") {
  const updated = ensureMetadata(
    {
      ...item,
      _updated_at:
        new Date().toISOString(),
      _sync_status: "pending"
    },
    prefix
  );

  updated._sync_hash =
    contentHash(updated);

  return updated;
}

function visible(items) {
  return (items || []).filter(
    item => !item?._deleted_at
  );
}

window.INTZCloud = {
  ensureCloud,
  syncUp,
  syncDown,
  syncAll,
  touch,
  visible,
  migrateCollection
};
``