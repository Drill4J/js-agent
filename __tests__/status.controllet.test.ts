import request from 'supertest';
import { app, server } from '../src/index';

beforeEach(() => {
  return server.close(() => console.log('Http server closed.'));
});

test('should test status controller', async () => {
  const res = await request(app.app).get('/');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({ status: 'Listening...' });
});
