import request from 'supertest';
import { app, server } from '../src/index';

beforeEach(() => {
  return server.close(() => console.log('Http server closed.'));
});

test('should test source maps controller', async () => {
  const data = {
    version: 3,
    file: 'test.js',
    name: '',
  };

  const res = await request(app.app)
    .post('/source-maps')
    .send(data);

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({
    status: 'Source map saved as ./sourceMaps/test.js.map',
  });
});
