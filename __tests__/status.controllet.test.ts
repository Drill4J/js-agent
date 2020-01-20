import request from 'supertest';
import { server } from '../src/index';
import { app } from '../src/app';

beforeEach(() => {
  return server.close(() => console.log('Http server closed.'));
});

test('should test status controller', async () => {
  const res = await request(app.app).get('/');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({ status: 'Listening...' });
});
