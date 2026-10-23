import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DatabaseService } from '../database/database.service';

const PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function okTickets(count: number, offset = 0) {
  return { data: Array.from({ length: count }, (_, i) => ({ status: 'ok', id: `ticket-${offset + i}` })) };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  const query = jest.fn();
  const fetchMock = jest.fn();

  beforeEach(async () => {
    query.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
      cb();
      return 0;
    }) as unknown as typeof setTimeout);

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: DatabaseService, useValue: { query } }],
    }).compile();
    service = module.get(NotificationsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inserta todas las notificaciones en un único INSERT por lote', async () => {
    query.mockResolvedValue({ rows: [] });
    const items = Array.from({ length: 3 }, (_, i) => ({
      userId: `00000000-0000-0000-0000-00000000000${i}`,
      type: 'COURT_SLOT_AVAILABLE',
      title: 'Cancha libre',
      body: `body ${i}`,
      data: { i },
    }));

    const created = await service.createMany(items);

    expect(created).toHaveLength(3);
    const inserts = query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO notifications'));
    expect(inserts).toHaveLength(1);
    const params = inserts[0][1] as unknown[][];
    expect(params[0]).toEqual(created.map((row) => row.id));
    expect(params[1]).toEqual(items.map((item) => item.userId));
    expect(params[5]).toEqual(items.map((item) => JSON.stringify(item.data)));
  });

  it('no manda push inmediato si pushAfter es futuro', async () => {
    query.mockResolvedValue({ rows: [] });
    const pushAfter = new Date(Date.now() + 60_000);

    await service.createMany([
      { userId: '00000000-0000-0000-0000-000000000001', type: 'COURT_SLOT_AVAILABLE', title: 't', body: 'b', pushAfter },
    ]);

    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO notifications'));
    expect((insert?.[1] as unknown[][])[6]).toEqual([pushAfter.toISOString()]);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('user_push_tokens'))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía a Expo en lotes de 100 mensajes', async () => {
    const targets = Array.from({ length: 250 }, (_, i) => ({
      payload: { userId: `user-${i}`, type: 'COURT_SLOT_AVAILABLE', title: 't', body: 'b' },
      notificationId: `notif-${i}`,
    }));
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: targets.map((target, i) => ({ user_id: target.payload.userId, token: `token-${i}` })),
      });
    let sent = 0;
    fetchMock.mockImplementation(async (url: string, init: { body: string }) => {
      if (url === RECEIPTS_URL) return jsonResponse(200, { data: {} });
      const batch = JSON.parse(init.body) as unknown[];
      const response = jsonResponse(200, okTickets(batch.length, sent));
      sent += batch.length;
      return response;
    });

    await (service as unknown as { sendPush: (t: typeof targets) => Promise<void> }).sendPush(targets);

    const pushCalls = fetchMock.mock.calls.filter(([url]) => url === PUSH_URL);
    expect(pushCalls.map(([, init]) => JSON.parse(init.body).length)).toEqual([100, 100, 50]);
    const firstMessage = JSON.parse(pushCalls[0][1].body)[0];
    expect(firstMessage).toMatchObject({
      to: 'token-0',
      data: { type: 'COURT_SLOT_AVAILABLE', notificationId: 'notif-0' },
    });
  });

  it('reintenta ante 429 y borra tokens DeviceNotRegistered', async () => {
    const targets = [
      { payload: { userId: 'user-1', type: 'T', title: 't', body: 'b' }, notificationId: 'n-1' },
      { payload: { userId: 'user-2', type: 'T', title: 't', body: 'b' }, notificationId: 'n-2' },
    ];
    query
      .mockResolvedValueOnce({
        rows: [
          { user_id: 'user-1', token: 'token-ok' },
          { user_id: 'user-2', token: 'token-stale' },
        ],
      })
      .mockResolvedValue({ rows: [] });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '1' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [
            { status: 'ok', id: 'ticket-ok' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { 'ticket-ok': { status: 'ok' } } }));

    await (service as unknown as { sendPush: (t: typeof targets) => Promise<void> }).sendPush(targets);

    expect(fetchMock.mock.calls.filter(([url]) => url === PUSH_URL)).toHaveLength(2);
    const deleteCall = query.mock.calls.find(([sql]) => String(sql).includes('DELETE FROM user_push_tokens'));
    expect(deleteCall?.[1]).toEqual([['token-stale']]);
  });

  it('no envía push de categorías que el usuario desactivó', async () => {
    const targets = [
      { payload: { userId: 'user-off', type: 'COURT_SLOT_AVAILABLE', title: 't', body: 'b' }, notificationId: 'n-1' },
      { payload: { userId: 'user-on', type: 'COURT_SLOT_AVAILABLE', title: 't', body: 'b' }, notificationId: 'n-2' },
      { payload: { userId: 'user-off', type: 'PAYMENT_OK', title: 't', body: 'b' }, notificationId: 'n-3' },
    ];
    query
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-off', preferences: { club_offers: false } }] })
      .mockResolvedValueOnce({
        rows: [
          { user_id: 'user-off', token: 'token-off' },
          { user_id: 'user-on', token: 'token-on' },
        ],
      });
    fetchMock.mockImplementation(async (url: string, init: { body: string }) => {
      if (url === RECEIPTS_URL) return jsonResponse(200, { data: {} });
      return jsonResponse(200, okTickets(JSON.parse(init.body).length));
    });

    await (service as unknown as { sendPush: (t: typeof targets) => Promise<void> }).sendPush(targets);

    const sentMessages = JSON.parse(fetchMock.mock.calls.find(([url]) => url === PUSH_URL)[1].body);
    expect(sentMessages.map((m: { data: { notificationId: string } }) => m.data.notificationId)).toEqual([
      'n-2',
      'n-3',
    ]);
  });

  it('no envía push de ofertas de un club silenciado', async () => {
    const targets = [
      { payload: { userId: 'user-1', type: 'CLUB_SEGMENT_CAMPAIGN', title: 't', body: 'b', data: { clubId: 'club-muted' } }, notificationId: 'n-1' },
      { payload: { userId: 'user-1', type: 'CLUB_SEGMENT_CAMPAIGN', title: 't', body: 'b', data: { clubId: 'club-ok' } }, notificationId: 'n-2' },
      { payload: { userId: 'user-1', type: 'MATCH_INVITE', title: 't', body: 'b', data: { clubId: 'club-muted' } }, notificationId: 'n-3' },
    ];
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', club_id: 'club-muted' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', token: 'token-1' }] });
    fetchMock.mockImplementation(async (url: string, init: { body: string }) => {
      if (url === RECEIPTS_URL) return jsonResponse(200, { data: {} });
      return jsonResponse(200, okTickets(JSON.parse(init.body).length));
    });

    await (service as unknown as { sendPush: (t: typeof targets) => Promise<void> }).sendPush(targets);

    const sentMessages = JSON.parse(fetchMock.mock.calls.find(([url]) => url === PUSH_URL)[1].body);
    expect(sentMessages.map((m: { data: { notificationId: string } }) => m.data.notificationId)).toEqual([
      'n-2',
      'n-3',
    ]);
  });

  it('guarda preferencias combinando con las actuales', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ preferences: { chat: false } }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.updatePreferences('user-1', { club_offers: false });

    expect(result).toEqual({
      matches: true,
      chat: false,
      tournaments: true,
      social: true,
      club_offers: false,
      achievements: true,
    });
    expect(JSON.parse(query.mock.calls[1][1][1])).toEqual(result);
  });

  it('no llama a Expo si ningún destinatario tiene tokens', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await (
      service as unknown as {
        sendPush: (t: Array<{ payload: unknown; notificationId: string }>) => Promise<void>;
      }
    ).sendPush([
      { payload: { userId: 'user-1', type: 'T', title: 't', body: 'b' }, notificationId: 'n-1' },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
