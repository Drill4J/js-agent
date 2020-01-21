import request from 'supertest';
import { initApp } from '../util';

test('should test status controller', async () => {
  const res = await request(initApp()).get('/');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({ status: 'Listening...' });
});
