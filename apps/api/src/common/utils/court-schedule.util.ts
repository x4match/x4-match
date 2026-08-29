/** SQL expression: when a match's court window ends (alias `m`). */
export const MATCH_COURT_END_AT_SQL = `
  CASE
    WHEN m.court_slot_id IS NOT NULL THEN (
      SELECT cas.slot_date::timestamp + (cas.end_hour * INTERVAL '1 hour')
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

export const COURT_SLOT_END_AT_SQL = `(slot_date::timestamp + (end_hour * INTERVAL '1 hour'))`;
