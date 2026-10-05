export class SportsDayValidationError extends Error {}

/** Return Sports Days newest first without exposing internal database fields. */
export async function getSportsDays(transaction) {
  const rows = await transaction`
    select id, name, is_active
    from public.sports_days
    order by is_active desc, source_order desc
  `;
  return rows.map((row) => ({
    ID: row.id,
    Name: row.name,
    Active: row.is_active,
  }));
}

/** Resolve an explicitly selected Sports Day or the single active one. */
export async function getSportsDay(transaction, requestedIdentifier) {
  const rows = requestedIdentifier
    ? await transaction`
        select id, name, is_active
        from public.sports_days
        where id = ${requestedIdentifier}
      `
    : await transaction`
        select id, name, is_active
        from public.sports_days
        where is_active
      `;
  return rows[0] || null;
}

/** Create a clean active Sports Day by copying reusable setup only. */
export async function createSportsDay(
  transaction,
  payload,
  createIdentifier = () => crypto.randomUUID(),
) {
  const name = String(payload.name || payload.Name || '').trim();
  if (!name || name.length > 80) {
    throw new SportsDayValidationError(
      'Sports Day name must contain between 1 and 80 characters.',
    );
  }
  const source = await getSportsDay(
    transaction,
    payload.sourceSportsDayId || payload.SourceSportsDayID,
  );
  if (!source) {
    throw new SportsDayValidationError('The source Sports Day does not exist.');
  }
  const duplicate = await transaction`
    select id from public.sports_days where lower(btrim(name)) = lower(${name})
  `;
  if (duplicate.length) {
    throw new SportsDayValidationError(
      'A Sports Day with that name already exists.',
    );
  }

  const sportsDayIdentifier = createIdentifier();
  await transaction`
    insert into public.sports_days (id, name, is_active)
    values (${sportsDayIdentifier}, ${name}, false)
  `;

  const sourceTeams = await transaction`
    select id, name, colour, is_active
    from public.teams
    where sports_day_id = ${source.id}
    order by source_order
  `;
  for (const team of sourceTeams) {
    const identifier = createIdentifier();
    await transaction`
      insert into public.teams
        (id, name, colour, is_active, sports_day_id)
      values
        (${identifier}, ${team.name}, ${team.colour}, ${team.is_active}, ${sportsDayIdentifier})
    `;
  }

  const profileIdentifiers = new Map();
  const sourceProfiles = await transaction`
    select id, name, first, second, third, fourth
    from public.point_profiles
    where sports_day_id = ${source.id}
    order by source_order
  `;
  for (const profile of sourceProfiles) {
    const identifier = createIdentifier();
    profileIdentifiers.set(profile.id, identifier);
    await transaction`
      insert into public.point_profiles
        (id, name, first, second, third, fourth, sports_day_id)
      values
        (${identifier}, ${profile.name}, ${profile.first}, ${profile.second},
         ${profile.third}, ${profile.fourth}, ${sportsDayIdentifier})
    `;
  }

  const sourceEvents = await transaction`
    select id, name, event_type, point_profile_id, display_order, enabled
    from public.events
    where sports_day_id = ${source.id}
    order by source_order
  `;
  for (const event of sourceEvents) {
    const eventIdentifier = createIdentifier();
    const eventRunIdentifier = createIdentifier();
    await transaction`
      insert into public.events
        (id, name, event_type, point_profile_id, status, display_order,
         enabled, sports_day_id)
      values
        (${eventIdentifier}, ${event.name}, ${event.event_type},
         ${profileIdentifiers.get(event.point_profile_id)}, 'NOT_STARTED',
         ${event.display_order}, ${event.enabled}, ${sportsDayIdentifier})
    `;
    await transaction`
      insert into public.event_runs
        (id, event_id, run_number, status, is_current, sports_day_id)
      values
        (${eventRunIdentifier}, ${eventIdentifier}, 1, 'NOT_STARTED', true,
         ${sportsDayIdentifier})
    `;
  }

  await transaction`update public.sports_days set is_active = false where is_active`;
  await transaction`
    update public.sports_days set is_active = true where id = ${sportsDayIdentifier}
  `;
  return { ID: sportsDayIdentifier, Name: name, Active: true };
}
