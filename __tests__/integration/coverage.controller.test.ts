/* eslint-disable */
import request from 'supertest';
import { readFileSync } from 'fs';
import { initApp } from '../util';
import { cleanAstData, cleanCoverageData } from '../../src/storage';

beforeEach(() => {
  cleanAstData();
  cleanCoverageData();
});

export function readJsonFile(name: string) {
  return JSON.parse(readFileSync(name, 'utf-8'));
}

const rootFolder = './__tests__/fixtures/todomvc';

const cases = [
  [
    ['/single/coverage.json'],
    '6b46ea8e-28e8-4fa0-b535-f1fc95f1fad4',
    '/single/expected.json',
  ],
  [
    [
      '/multiple/testCanAddTodo.json',
      '/multiple/testCanCancelEditTodo.json',
      '/multiple/testCanClearCompletedTodo.json',
      '/multiple/testCanDestroyTodo.json',
      '/multiple/testCanEditTodo.json',
      '/multiple/testCanNotAddEmptyTodo.json',
      '/multiple/testCanOpenDifferenturl.json',
      '/multiple/testCanSwitchActiveAndCompleted.json',
      '/multiple/testCanToggleAll.json',
      '/multiple/testTodoDeletedIfEmptyName.json',
    ],
    'aff7f389-56ff-4af4-a347-26a5f15e1a81',
    '/multiple/expected.json',
  ],
];

describe('should test coverage controller', () => {
  test('test empty data', async () => {
    const client = await request(initApp());

    const coverageResponse = await client.get('/coverage');

    expect(coverageResponse.status).toEqual(200);
  });

  test.each(cases)('given %ps and %p expect %p', async (cov, uuid, exp) => {
    const ast = readJsonFile(`${rootFolder}/ast.json`);

    const client = await request(initApp());

    const res = await client.post('/ast').send(ast);

    expect(res.status).toEqual(200);

    const sourceMap = readJsonFile(`${rootFolder}/Application.js.map`);

    const sourceMapRes = await client.post('/source-maps').send(sourceMap);

    expect(sourceMapRes.status).toEqual(200);
    expect(sourceMapRes.body).toEqual({
      status: 'Source map saved as ./sourceMaps/Application.js.map',
    });

    for (const c of cov) {
      const coverage = readJsonFile(`${rootFolder}/${c}`);

      const covRes = await client.post('/coverage').send(coverage);

      expect(covRes.status).toEqual(200);
      expect(covRes.body).toHaveProperty('status');
    }

    const coverageResponse = await client
      .get('/coverage')
      .query({ branch: ast.branch });

    expect(coverageResponse.status).toEqual(200);

    const expected = readJsonFile(`${rootFolder}/${exp}`);

    expect(coverageResponse.body).toEqual(expected);
  });

  test('test coverage raw data handler', async () => {
    const sourceMap = readJsonFile(`${rootFolder}/Application.js.map`);

    const client = await request(initApp());

    await client.post('/source-maps').send(sourceMap);

    const coverage = readJsonFile(`${rootFolder}/multiple/testCanAddTodo.json`);

    const covRes = await client.post('/coverage').send(coverage);

    expect(covRes.status).toEqual(200);
    expect(covRes.body).toHaveProperty('status');
  });

  test('test can get risks', async () => {
    const ast = readJsonFile(`${rootFolder}/ast.json`);

    const client = await request(initApp());

    const res = await client.post('/ast').send(ast);

    expect(res.status).toEqual(200);

    const sourceMap = readJsonFile(`${rootFolder}/Application.js.map`);

    const sourceMapRes = await client.post('/source-maps').send(sourceMap);

    expect(sourceMapRes.status).toEqual(200);
    expect(sourceMapRes.body).toEqual({
      status: 'Source map saved as ./sourceMaps/Application.js.map',
    });

    const coverage = readJsonFile(`${rootFolder}/single/coverage.json`);

    const covRes = await client.post('/coverage').send(coverage);

    expect(covRes.status).toEqual(200);
    expect(covRes.body).toHaveProperty('status');

    const coverageResponse = await client
      .get('/coverage')
      .query({ branch: ast.branch });

    expect(coverageResponse.status).toEqual(200);

    const risks = await client.get('/risks').query({ branch: ast.branch });

    expect(risks.body).toEqual([
      {
        coveredLines: [],
        lines: [],
        method: '$inject',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [58, 59, 60, 61, 62, 63],
        method: 'onTodos',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [75, 76, 78, 79, 80],
        method: 'editTodo',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [82, 83, 84, 85],
        method: 'revertEdits',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99],
        method: 'doneEditing',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [101, 102, 103],
        method: 'removeTodo',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [105, 106, 107],
        method: 'clearDoneTodos',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [109, 110, 111],
        method: 'markAll',
        tests: [],
      },
      {
        coveredLines: [],
        lines: [17, 18, 19],
        method: 'put',
        tests: [],
      },
    ]);
  });
});
