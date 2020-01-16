import request from 'supertest';
import { app, server } from '../src/index';
import { readFileSync } from 'fs';

function readJsonFile(name: string) {
  return JSON.parse(readFileSync(name, 'utf-8'));
}

beforeEach(() => {
  return server.close();
});

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

    const res = await request(app.app)
      .post('/ast')
      .send(ast);

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({ status: 'ast data saved' });

    const sourceMap = readJsonFile(`${rootFolder}/Application.js.map`);

    const sourceMapRes = await request(app.app)
      .post('/source-maps')
      .send(sourceMap);

    expect(sourceMapRes.status).toEqual(200);
    expect(sourceMapRes.body).toEqual({
      status: 'Source map saved as ./sourceMaps/Application.js.map',
    });

    for (const c of cov) {
      const coverage = readJsonFile(`${rootFolder}/${c}`);

      const covRes = await request(app.app)
        .post('/coverage')
        .send(coverage);

      expect(covRes.status).toEqual(200);
      expect(covRes.body).toEqual({ status: 'coverage data saved' });
    }

    const coverageResponse = await request(app.app)
      .get('/coverage')
      .query({ uuid: uuid });

    expect(coverageResponse.status).toEqual(200);

    const expected = readJsonFile(`${rootFolder}/${exp}`);

    expect(coverageResponse.body).toEqual(expected);
  });
});
