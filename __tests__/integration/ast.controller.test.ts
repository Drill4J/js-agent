import request from 'supertest';
import { server } from '../../src/index';
import { initApp } from '../util';

test('should test ast controller', async () => {
  const data = [
    {
      filePath: '/src/js/demo.js',
      data: {
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

test('test can get ast tree', async () => {
  const client = request(initApp());

  const data = [
    {
      filePath: '/js/Application.ts',
      data: {
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

  await client.post('/ast').send(data);

  const res = await client.get('/tree');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual([
    {
      fileName: '/js/Application.ts',
      methods: [{ name: 'constructor', params: [] }],
    },
  ]);
});
