import request from 'supertest';
import { server } from '../../src/index';
import { readFileSync } from 'fs';
import { initApp } from '../util';

function readJsonFile(name: string) {
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
  test.each(cases)('given %ps and %p expect %p', async (cov, uuid, exp) => {
    const ast = readJsonFile(`${rootFolder}/ast.json`);

    const client = await request(initApp());

    const res = await client.post('/ast').send(ast);

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({ status: 'ast data saved' });

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
      expect(covRes.body).toEqual({ status: 'coverage data saved' });
    }

    const coverageResponse = await client
      .get('/coverage')
      .query({ uuid: uuid });

    expect(coverageResponse.status).toEqual(200);

    const expected = readJsonFile(`${rootFolder}/${exp}`);

    expect(coverageResponse.body).toEqual(expected);
  });
});

test('test coverage raw data handler', async () => {
  const sourceMap = readJsonFile(`${rootFolder}/Application.js.map`);

  const client = await request(initApp());

  await client.post('/source-maps').send(sourceMap);

  const coverage = readJsonFile(`${rootFolder}/multiple/testCanAddTodo.json`);

  const covRes = await client.post('/coverage').send(coverage);

  expect(covRes.status).toEqual(200);
  expect(covRes.body).toEqual({ status: 'coverage data saved' });
});
