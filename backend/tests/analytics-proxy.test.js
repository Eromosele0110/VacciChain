const request = require('supertest');
const app = require('../src/app');

const upstream = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

describe('analytics proxy (#37)', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('forwards documented analytics paths and returns upstream data', async () => {
    fetchMock.mockResolvedValue(upstream({ rates: [{ vaccine_name: 'MMR', count: 5 }] }));

    const res = await request(app).get('/v1/analytics/rates');

    expect(res.status).toBe(200);
    expect(res.body.rates).toEqual([{ vaccine_name: 'MMR', count: 5 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/analytics/rates'),
      expect.any(Object)
    );
  });

  it('rejects undocumented analytics paths with a predictable 400', async () => {
    const res = await request(app).get('/v1/analytics/secret-metrics');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Undocumented analytics path');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps upstream failures to a predictable 502', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));

    const res = await request(app).get('/v1/analytics/issuers');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Analytics service unavailable');
  });

  it('maps upstream timeouts to a predictable 504', async () => {
    jest.useFakeTimers();
    let resolveFetch;
    fetchMock.mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));

    const promise = request(app).get('/v1/analytics/anomalies');

    jest.advanceTimersByTime(9000);
    await promise;

    expect(fetchMock).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
