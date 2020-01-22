import request from 'supertest';
import { initApp } from '../util';

test('should test source maps controller', async () => {
  const data = {
    version: 3,
    file: 'test.js',
    name: '',
  };

  const res = await request(initApp())
    .post('/source-maps')
    .send(data);

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({
    status: 'Source map saved as ./sourceMaps/test.js.map',
  });
});
