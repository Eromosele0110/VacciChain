const request = require('supertest');
const app = require('../src/app');
const health = require('../src/health');

describe('Health check', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /health returns degraded when Soroban is unhealthy', async () => {
    health.setSorobanHealthy(false);
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    health.setSorobanHealthy(true);
  });
});

describe('Auth routes', () => {
  it('POST /v1/auth/sep10 requires public_key', async () => {
    const res = await request(app).post('/v1/auth/sep10').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(JSON.stringify(res.body.details)).toMatch(/public_key/);
  });

  it('POST /v1/auth/sep10 rejects invalid key', async () => {
    const res = await request(app).post('/v1/auth/sep10').send({ public_key: 'not-a-key' });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/verify requires transaction and nonce', async () => {
    const res = await request(app).post('/v1/auth/verify').send({});
    expect(res.status).toBe(400);
  });
});

describe('Vaccination routes', () => {
  it('POST /v1/vaccination/issue requires auth', async () => {
    const res = await request(app).post('/v1/vaccination/issue').send({});
    expect(res.status).toBe(401);
  });

  it('GET /vaccination/:wallet requires auth', async () => {
    const res = await request(app).get('/v1/vaccination/GABC');
    expect(res.status).toBe(401);
  });
});

describe('Verify route', () => {
  it('GET /verify/:wallet rejects invalid address', async () => {
    const res = await request(app).get('/v1/verify/invalid-address');
    expect(res.status).toBe(400);
  });
});

describe('API versioning (#36)', () => {
  it('sets API-Version header on /v1 responses', async () => {
    const res = await request(app).get('/v1/verify/invalid-address');
    expect(res.headers['api-version']).toBe('1');
  });

  it('redirects legacy unversioned routes to /v1 with Deprecation header', async () => {
    const res = await request(app).get('/auth/sep10');
    expect(res.status).toBe(308);
    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers.location).toBe('/v1/auth/sep10');
  });

  it('redirects legacy patient route to /v1/patient', async () => {
    const res = await request(app).get('/patient/register');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('/v1/patient/register');
  });

  it('redirects legacy onboarding route to /v1/onboarding', async () => {
    const res = await request(app).post('/onboarding/apply');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('/v1/onboarding/apply');
  });

  it('does not mount conflicting legacy handlers (legacy paths only redirect)', async () => {
    // Legacy /vaccination/issue must not respond directly; it redirects.
    const res = await request(app).post('/vaccination/issue');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('/v1/vaccination/issue');
  });
});
