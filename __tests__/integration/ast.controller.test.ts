import request from 'supertest';
import { server } from '../../src/index';
import { initApp } from '../util';

test('should test ast controller', async () => {
  const data = [
    {
      filePath: '/src/js/demo.js',
      result: {
        className: 'AppComponent',
        methods: [
          {
            name: 'constructor',
            loc: {
              start: { line: 10, column: 2 },
              end: { line: 12, column: 6 },
            },
            params: [],
            body: {},
          },
        ],
      },
    },
  ];

  const res = await request(initApp())
    .post('/ast')
    .send(data);

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({ status: 'ast data saved' });
});

beforeEach(async () => {
  await server.close();
});
