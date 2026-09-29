export const COURT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * SQL expression (timestamptz): instante real de inicio/fin de un turno.
 * `slot_date` + hora son hora local del club; la sesión de Postgres corre en UTC.
 */
export function courtSlotAtSql(hourColumn: 'start_hour' | 'end_hour', alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return `((${prefix}slot_date::timestamp + (${prefix}${hourColumn} * INTERVAL '1 hour')) AT TIME ZONE '${COURT_TIMEZONE}')`;
}

/** SQL expression: when a match's court window ends (alias `m`). */
export const MATCH_COURT_END_AT_SQL = `
  CASE
    WHEN m.court_slot_id IS NOT NULL THEN (
      SELECT ${courtSlotAtSql('end_hour', 'cas')}
      FROM court_availability_slots cas
      WHERE cas.id = m.court_slot_id
    )
    WHEN m.ends_at IS NOT NULL THEN m.ends_at
    ELSE m.date + (
      COALESCE(
        (SELECT c.court_duration_hours FROM clubs c WHERE c.id = m.club_id),
        1.5
      ) * INTERVAL '1 hour'
    )
  END
`;

export const COURT_SLOT_END_AT_SQL = courtSlotAtSql('end_hour');
