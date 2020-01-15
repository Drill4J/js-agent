import request from 'supertest';
import { app, server } from '../src/index';
import { readFileSync } from 'fs';

beforeEach(async () => {
  await server.close();
});

const expected = [
  {
    file: '/js/Application.ts',
    methods: [],
  },
  {
    file: '/js/_all.ts',
    methods: [],
  },
  {
    file: '/js/controllers/TodoCtrl.ts',
    methods: [
      {
        method: '$inject',
        covered: 54,
        tests: ['testCanAddTodo'],
      },
      {
        method: 'constructor',
        covered: 140,
        tests: ['testCanAddTodo'],
      },
      {
        method: 'onPath',
        covered: 38,
        tests: ['testCanAddTodo'],
      },
      {
        method: 'onTodos',
        covered: 144,
        tests: ['testCanAddTodo'],
      },
      {
        method: 'addTodo',
        covered: 57,
        tests: ['testCanAddTodo'],
      },
      {
        method: 'editTodo',
        covered: 0,
        tests: [],
      },
      {
        method: 'revertEdits',
        covered: 0,
        tests: [],
      },
      {
        method: 'doneEditing',
        covered: 0,
        tests: [],
      },
      {
        method: 'removeTodo',
        covered: 0,
        tests: [],
      },
      {
        method: 'clearDoneTodos',
        covered: 0,
        tests: [],
      },
      {
        method: 'markAll',
        covered: 0,
        tests: [],
      },
    ],
  },
  {
    file: '/js/directives/TodoBlur.ts',
    methods: [
      {
        method: 'todoBlur',
        covered: 340,
        tests: ['testCanAddTodo'],
      },
    ],
  },
  {
    file: '/js/directives/TodoEscape.ts',
    methods: [
      {
        method: 'todoEscape',
        covered: 432,
        tests: ['testCanAddTodo'],
      },
    ],
  },
  {
    file: '/js/directives/TodoFocus.ts',
    methods: [
      {
        method: 'todoFocus',
        covered: 404,
        tests: ['testCanAddTodo'],
      },
    ],
  },
  {
    file: '/js/models/TodoItem.ts',
    methods: [
      {
        method: 'constructor',
        covered: 28,
        tests: ['testCanAddTodo'],
      },
    ],
  },
  {
    file: '/js/services/TodoStorage.ts',
    methods: [
      {
        method: 'get',
        covered: 184,
        tests: ['testCanAddTodo'],
      },
      {
        method: 'put',
        covered: 64,
        tests: ['testCanAddTodo'],
      },
    ],
  },
];

test('should test coverage controller', async () => {
  const ast = JSON.parse(
    readFileSync('./__tests__/fixtures/todomvc/ast.json', 'utf-8')
  );

  const res = await request(app.app)
    .post('/ast')
    .send(ast);

  expect(res.status).toEqual(200);
  expect(res.body).toEqual({ status: 'ast data saved' });

  const sourceMap = JSON.parse(
    readFileSync('./__tests__/fixtures/todomvc/Application.js.map', 'utf-8')
  );

  const sourceMapRes = await request(app.app)
    .post('/source-maps')
    .send(sourceMap);

  expect(sourceMapRes.status).toEqual(200);
  expect(sourceMapRes.body).toEqual({
    status: 'Source map saved as ./sourceMaps/Application.js.map',
  });

  const coverage = JSON.parse(
    readFileSync('./__tests__/fixtures/todomvc/coverage.json', 'utf-8')
  );

  const covRes = await request(app.app)
    .post('/coverage')
    .send(coverage);

  expect(covRes.status).toEqual(200);
  expect(covRes.body).toEqual({ status: 'coverage data saved' });

  const coverageResponse = await request(app.app)
    .get('/coverage')
    .query({ uuid: '6b46ea8e-28e8-4fa0-b535-f1fc95f1fad4' });

  expect(coverageResponse.status).toEqual(200);
  expect(coverageResponse.body).toEqual(expected);
});
