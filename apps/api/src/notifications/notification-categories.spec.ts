import { categoryForType, resolvePreferences } from './notification-categories';

describe('categoryForType', () => {
  it.each([
    ['MATCH_INVITE', 'matches'],
    ['MATCH_REMINDER', 'matches'],
    ['CLUB_CHALLENGE', 'matches'],
    ['MATCH_CHAT_MESSAGE', 'chat'],
    ['DM_REQUEST', 'chat'],
    ['tournament_rival', 'tournaments'],
    ['CIRCUIT_STAFF_INVITE', 'tournaments'],
    ['circuit_schedule', 'tournaments'],
    ['MASTER_UPDATE', 'tournaments'],
    ['FRIEND_REQUEST', 'social'],
    ['NEW_FOLLOWER', 'social'],
    ['COURT_SLOT_AVAILABLE', 'club_offers'],
    ['COURT_GAP_OFFER', 'club_offers'],
    ['OPEN_MATCH_CREATED', 'club_offers'],
    ['CLUB_SEGMENT_CAMPAIGN', 'club_offers'],
    ['BADGE_EARNED', 'achievements'],
    ['RANKING_OVERTAKEN', 'achievements'],
    ['REWARD_REDEEMED', 'achievements'],
  ])('%s → %s', (type, category) => {
    expect(categoryForType(type)).toBe(category);
  });

  it('deja sin categoría los avisos operativos', () => {
    expect(categoryForType('PAYMENT_APPROVED')).toBe(null);
    expect(categoryForType('CIRCUIT_INVITE_CODE')).toBe('tournaments');
  });
});

describe('resolvePreferences', () => {
  it('activa por defecto las categorías ausentes', () => {
    expect(resolvePreferences({ chat: false, unknown: false })).toEqual({
      matches: true,
      chat: false,
      tournaments: true,
      social: true,
      club_offers: true,
      achievements: true,
    });
    expect(resolvePreferences(null).club_offers).toBe(true);
  });
});
