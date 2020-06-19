import request from 'supertest';
import { initApp } from '../util';
import { readJsonFile } from './coverage.controller.test';
import storage from '../../src/storage'; // TODO import service instead?

beforeEach(async () => {
  await storage.cleanAst();
});

test('should return [] when wrong branch name', async () => {
  const res = await request(initApp()).get('/ast?branch=ast');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual([]);
});

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
  expect(res.body).toHaveProperty('buildId');
  expect(res.body.status).toBe('Ast data saved');
});

test('test can get ast tree', async () => {
  const client = request(initApp());

  const ast = {
    branch: '1',
    data: [
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
    ],
  };

  await client.post('/ast').send(ast);

  const res = await client.get(`/tree?branch=${ast.branch}`);

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

  const oldData = {
    branch: 'master',
    data: [
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
    ],
  };

  const newData = {
    branch: 'test',
    data: [
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
    ],
  };

  await client.post('/ast').send(oldData);
  await client.post('/ast').send(newData);

  const res = await client.get('/ast/diff?branch=test');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({
    new: ['newMethod'],
    updated: ['addItem'],
  });
});

test('test can get empty ast diff when only first build', async () => {
  const client = request(initApp());

  const newData = {
    branch: 'test',
    data: [
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
    ],
  };

  await client.post('/ast').send(newData);

  const res = await client.get('/ast/diff');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({
    new: [],
    updated: [],
  });
});

test('test can get ast diff after first build changes', async () => {
  const client = request(initApp());

  const oldData = readJsonFile(
    './__tests__/fixtures/todomvc/ast_diff/old.json',
  );

  const newData = readJsonFile(
    './__tests__/fixtures/todomvc/ast_diff/new.json',
  );

  await client.post('/ast').send(oldData);
  await client.post('/ast').send(newData);

  const res = await client.get(`/ast/diff?branch=${newData.branch}`);

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({ new: ['newMethod'], updated: ['removeTodo'] });
});
