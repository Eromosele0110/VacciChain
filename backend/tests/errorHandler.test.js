const request = require('supertest');
const express = require('express');
const errorHandler = require('../src/middleware/errorHandler');
const { AppError } = require('../src/middleware/errors');
const requestId = require('../src/middleware/requestId');

function makeApp(routeHandler) {
  const app = express();
  app.use(requestId);
  app.get('/test', routeHandler);
  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  it('returns 500 with generic message for unexpected errors', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new Error('db exploded'));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('internal_server_error');
    expect(res.body.message).toBe('Internal Server Error');
    expect(res.body.requestId).toBeDefined();
    // internal detail must not leak
    expect(JSON.stringify(res.body)).not.toMatch(/db exploded/);
  });

  it('returns 4xx with the original message for operational errors', async () => {
    const app = makeApp((_req, _res, next) => {
      const err = new Error('resource not found');
      err.statusCode = 404;
      next(err);
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('resource not found');
    expect(res.body.requestId).toBeDefined();
  });

  it('returns standardized shape for AppError', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new AppError('validation_failed', 'bad input', 400));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_failed');
    expect(res.body.message).toBe('bad input');
    expect(res.body.requestId).toBeDefined();
  });

  it('includes requestId in the response body', async () => {
    const app = makeApp((_req, _res, next) => next(new Error('boom')));
    const res = await request(app).get('/test');
    expect(typeof res.body.requestId).toBe('string');
    expect(res.body.requestId.length).toBeGreaterThan(0);
  });

  it('uses the requestId from X-Request-ID header when provided', async () => {
    const app = makeApp((_req, _res, next) => next(new Error('boom')));
    const res = await request(app).get('/test').set('X-Request-ID', 'my-trace-id');
    expect(res.body.requestId).toBe('my-trace-id');
  });

  it('defaults to 500 when statusCode is not set', async () => {
    const app = makeApp((_req, _res, next) => {
      const err = new Error('unexpected');
      next(err);
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
  });

  it('defaults to 500 for invalid statusCode values', async () => {
    const app = makeApp((_req, _res, next) => {
      const err = new Error('bad code');
      err.statusCode = 'oops';
      next(err);
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
  });

  it('handles 5xx statusCode as unexpected (generic message)', async () => {
    const app = makeApp((_req, _res, next) => {
      const err = new Error('downstream failure');
      err.statusCode = 503;
      next(err);
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Internal Server Error');
  });
});
