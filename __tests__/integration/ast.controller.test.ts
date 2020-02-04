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

test('test can get ast diff', async () => {
  const client = request(initApp());

  const oldData = [
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
          {
            name: 'addItem',
            loc: {
              start: { line: 14, column: 2 },
              end: { line: 15, column: 6 },
            },
            params: [],
            body: {},
          },
        ],
      },
    },
  ];

  const newData = [
    {
      filePath: '/js/Application.ts',
      data: {
        className: 'AppComponent',
        methods: [
          {
            name: 'constructor',
            loc: {
              start: { line: 10, column: 5 },
              end: { line: 12, column: 7 },
            },
            params: [],
            body: {},
          },
          {
            name: 'addItem',
            loc: {
              start: { line: 14, column: 2 },
              end: { line: 15, column: 6 },
            },
            params: ['itemName'],
            body: {},
          },
          {
            name: 'newMethod',
            loc: {
              start: { line: 11, column: 2 },
              end: { line: 13, column: 6 },
            },
            params: ['hello'],
            body: {},
          },
        ],
      },
    },
  ];

  await client.post('/ast').send(oldData);
  await client.post('/ast').send(newData);

  const res = await client.get('/ast/diff');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({
    new: ['newMethod'],
    updated: ['addItem'],
  });
});

test('test can get ampty ast diff when only first build', async () => {
  const client = request(initApp());

  const newData = [
    {
      filePath: '/js/Application.ts',
      data: {
        className: 'AppComponent',
        methods: [
          {
            name: 'constructor',
            loc: {
              start: { line: 10, column: 5 },
              end: { line: 12, column: 7 },
            },
            params: [],
            body: {},
          },
          {
            name: 'addItem',
            loc: {
              start: { line: 14, column: 2 },
              end: { line: 15, column: 6 },
            },
            params: ['itemName'],
            body: {},
          },
          {
            name: 'newMethod',
            loc: {
              start: { line: 11, column: 2 },
              end: { line: 13, column: 6 },
            },
            params: ['hello'],
            body: {},
          },
        ],
      },
    },
  ];

  await client.post('/ast').send(newData);

  const res = await client.get('/ast/diff');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({
    new: [],
    updated: [],
  });
});
