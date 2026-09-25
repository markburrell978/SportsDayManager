// Explicit compatibility mapping: SQL metadata never leaks into v1 responses.
const defineTableMapping = (table, fields, sequence = false) => ({
  table,
  fields,
  sequence,
});
export const TABLE_MAPPINGS = {
  Teams: defineTableMapping('teams', {
    ID: 'id',
    Name: 'name',
    Colour: 'colour',
    Active: 'is_active',
  }),
  Competitors: defineTableMapping('competitors', {
    ID: 'id',
    Name: 'name',
    Age: 'age',
    Gender: 'gender',
    CompetitionGender: 'competition_gender',
    TeamID: 'team_id',
    Active: 'is_active',
  }),
  PointProfiles: defineTableMapping('point_profiles', {
    ID: 'id',
    Name: 'name',
    First: 'first',
    Second: 'second',
    Third: 'third',
    Fourth: 'fourth',
  }),
  Events: defineTableMapping('events', {
    ID: 'id',
    Name: 'name',
    EventType: 'event_type',
    PointsProfileID: 'point_profile_id',
    Status: 'status',
    DisplayOrder: 'display_order',
    Enabled: 'enabled',
  }),
  EventRuns: defineTableMapping('event_runs', {
    ID: 'id',
    EventID: 'event_id',
    RunNumber: 'run_number',
    Status: 'status',
    IsCurrent: 'is_current',
    StartedAt: 'started_at',
    CompletedAt: 'completed_at',
    ResetFromRunID: 'reset_from_run_id',
  }),
  Results: defineTableMapping(
    'results',
    {
      ID: 'id',
      EventID: 'event_id',
      EventRunID: 'event_run_id',
      TeamID: 'team_id',
      Position: 'position',
      PointsAwarded: 'points_awarded',
    },
    true,
  ),
  Matches: defineTableMapping(
    'matches',
    {
      ID: 'id',
      EventID: 'event_id',
      EventRunID: 'event_run_id',
      Round: 'round',
      Team1ID: 'team_1_id',
      Team2ID: 'team_2_id',
      WinnerID: 'winner_id',
      Complete: 'complete',
    },
    true,
  ),
  RaceResults: defineTableMapping(
    'race_results',
    {
      ID: 'id',
      EventID: 'event_id',
      EventRunID: 'event_run_id',
      CompetitionGender: 'competition_gender',
      TeamID: 'team_id',
      CompetitorID: 'competitor_id',
      FinalPosition: 'final_position',
    },
    true,
  ),
  EventCompetitors: defineTableMapping('event_competitors', {
    EventID: 'event_id',
    EventRunID: 'event_run_id',
    CompetitorID: 'competitor_id',
  }),
  DistanceResults: defineTableMapping(
    'distance_results',
    {
      ID: 'id',
      EventID: 'event_id',
      EventRunID: 'event_run_id',
      CompetitionGender: 'competition_gender',
      TeamID: 'team_id',
      Position: 'position',
    },
    true,
  ),
  DoubleTeamMatches: defineTableMapping('double_team_matches', {
    ID: 'id',
    EventID: 'event_id',
    EventRunID: 'event_run_id',
    Side1Team1ID: 'side_1_team_1_id',
    Side1Team2ID: 'side_1_team_2_id',
    Side2Team1ID: 'side_2_team_1_id',
    Side2Team2ID: 'side_2_team_2_id',
    WinnerSide: 'winner_side',
    Complete: 'complete',
  }),
  Attempts: defineTableMapping(
    'attempts',
    {
      ID: 'id',
      EventID: 'event_id',
      EventRunID: 'event_run_id',
      CompetitorID: 'competitor_id',
      AttemptNumber: 'attempt_number',
      Value: 'value',
    },
    true,
  ),
};
/** Columns whose legacy blank values represent SQL nulls. */
const nullableColumns = new Set([
  'started_at',
  'completed_at',
  'reset_from_run_id',
  'winner_id',
  'final_position',
  'winner_side',
]);

/** Identify a legacy row, including entrant mappings without a separate ID. */
function recordKey(record) {
  return record.ID ?? `${record.EventRunID}\u0000${record.CompetitorID}`;
}

/** Translate a database record without exposing internal SQL metadata. */
function toLegacyRecord(mapping, record) {
  return Object.fromEntries(
    Object.entries(mapping.fields).map(([field, column]) => [
      field,
      record[column] ?? '',
    ]),
  );
}

/** Translate legacy blanks only where the database column is nullable. */
function toDatabaseRecord(mapping, record) {
  return Object.fromEntries(
    Object.entries(mapping.fields).map(([field, column]) => [
      column,
      record[field] === '' && nullableColumns.has(column)
        ? null
        : record[field],
    ]),
  );
}

/** Journal legacy-style changes so they can be committed in one transaction. */
export class UnitOfWork {
  /** Isolate request data from the caller and start an empty write journal. */
  constructor(rows) {
    this.rows = structuredClone(rows);
    this.operations = [];
  }

  /** Report whether a supported logical table exists. */
  exists(tableName) {
    return Object.hasOwn(TABLE_MAPPINGS, tableName);
  }

  /** Return legacy field names in their original order. */
  getHeaders(tableName) {
    return Object.keys(TABLE_MAPPINGS[tableName].fields);
  }

  /** Return detached rows so callers cannot bypass the write journal. */
  get(tableName) {
    return structuredClone(this.rows[tableName]);
  }

  /** Find a detached record by its stable identifier. */
  findById(tableName, identifier) {
    return (
      this.get(tableName).find((record) => record.ID === identifier) || null
    );
  }

  /** Keep only known legacy fields and fill absent values with Sheet blanks. */
  project(tableName, record) {
    return Object.fromEntries(
      this.getHeaders(tableName).map((field) => [field, record[field] ?? '']),
    );
  }

  /** Add a record to the request view and journal its insertion. */
  insert(tableName, record) {
    const row = this.project(tableName, record);
    this.rows[tableName].push(row);
    this.operations.push({
      kind: 'insert',
      name: tableName,
      row: structuredClone(row),
    });
  }

  /** Merge known fields into one record and journal its update. */
  update(tableName, identifier, updates) {
    const row = this.rows[tableName].find((record) => record.ID === identifier);
    if (!row) {
      return false;
    }
    Object.assign(row, this.project(tableName, { ...row, ...updates }));
    this.operations.push({
      kind: 'update',
      name: tableName,
      row: structuredClone(row),
    });
    return true;
  }

  /** Update each matching record and report how many records changed. */
  updateWhere(tableName, predicate, updates) {
    let updatedCount = 0;
    for (const row of this.rows[tableName]) {
      if (!predicate(structuredClone(row))) {
        continue;
      }
      Object.assign(row, this.project(tableName, { ...row, ...updates }));
      this.operations.push({
        kind: 'update',
        name: tableName,
        row: structuredClone(row),
      });
      updatedCount++;
    }
    return updatedCount;
  }

  /** Remove matching rows while retaining detached deletion records. */
  removeWhere(tableName, predicate) {
    const removedRows = this.rows[tableName].filter((row) =>
      predicate(structuredClone(row)),
    );
    const removedKeys = new Set(removedRows.map(recordKey));
    this.rows[tableName] = this.rows[tableName].filter(
      (row) => !removedKeys.has(recordKey(row)),
    );
    for (const row of removedRows) {
      this.operations.push({
        kind: 'delete',
        name: tableName,
        row: structuredClone(row),
      });
    }
    return removedRows.length;
  }

  /** Remove one record by identifier and report whether it existed. */
  remove(tableName, identifier) {
    return this.removeWhere(tableName, (row) => row.ID === identifier) > 0;
  }

  /** Reject legacy schema rewrites; SQL schema changes require migrations. */
  replaceAll() {
    throw new Error(
      'Legacy Sheet schema conversion must run before importing into PostgreSQL.',
    );
  }
}

/** Apply the ordered journal using server-owned identifiers and bound values. */
async function flushOperations(transaction, operations, sequences) {
  for (const { kind, name: tableName, row } of operations) {
    const mapping = TABLE_MAPPINGS[tableName];
    const values = toDatabaseRecord(mapping, row);
    if (kind === 'insert') {
      if (mapping.sequence) {
        const sequenceKey = tableName + ':' + values.event_run_id;
        values.sequence_number = (sequences.get(sequenceKey) || 0) + 1;
        sequences.set(sequenceKey, values.sequence_number);
      }
      const columns = Object.keys(values);
      const placeholders = columns.map(
        (unusedColumn, columnIndex) => '$' + (columnIndex + 1),
      );
      await transaction.unsafe(
        `insert into public.${mapping.table} (${columns.join(',')}) values (${placeholders.join(',')})`,
        Object.values(values),
      );
      continue;
    }
    const keyColumns =
      tableName === 'EventCompetitors'
        ? ['event_run_id', 'competitor_id']
        : ['id'];
    const updatedColumns = Object.keys(values).filter(
      (column) => !keyColumns.includes(column),
    );
    const parameters =
      kind === 'update' ? updatedColumns.map((column) => values[column]) : [];
    const conditions = keyColumns
      .map((column) => {
        parameters.push(values[column]);
        return `${column} = $${parameters.length}`;
      })
      .join(' and ');
    const assignments = updatedColumns
      .map((column, columnIndex) => `${column} = $${columnIndex + 1}`)
      .join(',');
    const statement =
      kind === 'delete'
        ? `delete from public.${mapping.table} where ${conditions}`
        : `update public.${mapping.table} set ${assignments} where ${conditions}`;
    const result = await transaction.unsafe(statement, parameters);
    if (result.count !== 1) {
      throw new Error(
        'The record changed while saving. Please refresh and try again.',
      );
    }
  }
}

/** Load the small organiser dataset into one transaction-scoped repository. */
export async function loadRepository(transaction) {
  const rows = {};
  const sequences = new Map();
  for (const [tableName, mapping] of Object.entries(TABLE_MAPPINGS)) {
    // Table names and ordering come exclusively from this module's mappings.
    const ordering = mapping.sequence
      ? 'event_run_id, sequence_number'
      : 'source_order';
    const records = await transaction.unsafe(
      `select * from public.${mapping.table} order by ${ordering}`,
    );
    rows[tableName] = records.map((record) => {
      if (mapping.sequence) {
        const sequenceKey = tableName + ':' + record.event_run_id;
        sequences.set(
          sequenceKey,
          Math.max(sequences.get(sequenceKey) || 0, record.sequence_number),
        );
      }
      return toLegacyRecord(mapping, record);
    });
  }
  const repository = new UnitOfWork(rows);
  // A repository belongs to one request and is flushed exactly once by the API.
  repository.flush = () =>
    flushOperations(transaction, repository.operations, sequences);
  return repository;
}
