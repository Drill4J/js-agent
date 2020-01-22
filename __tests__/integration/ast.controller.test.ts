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

test('test can get ast tree', async () => {
  const client = request(initApp());

  const data = {
    projectName: 'real-world-app',
    results: [
      {
        filePath: '/js/Application.ts',
        result: {
          methods: [
            {
              params: ['TodoStorage'],
              name: 'todomvc',
              loc: {
                start: {
                  line: 11,
                  column: 18,
                },
                end: {
                  line: 16,
                  column: 48,
                },
              },
              body: {
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  object: {
                    type: 'CallExpression',
                    callee: {
                      type: 'MemberExpression',
                      object: {
                        type: 'CallExpression',
                        callee: {
                          type: 'MemberExpression',
                          object: {
                            type: 'CallExpression',
                            callee: {
                              type: 'MemberExpression',
                              object: {
                                type: 'CallExpression',
                                callee: {
                                  type: 'MemberExpression',
                                  object: {
                                    type: 'CallExpression',
                                    callee: {
                                      type: 'MemberExpression',
                                      object: {
                                        type: 'Identifier',
                                        name: 'angular',
                                      },
                                      property: {
                                        type: 'Identifier',
                                        name: 'module',
                                      },
                                      computed: false,
                                      optional: false,
                                    },
                                    arguments: [
                                      {
                                        type: 'Literal',
                                        raw: "'todomvc'",
                                        value: 'todomvc',
                                      },
                                      {
                                        type: 'ArrayExpression',
                                        elements: [],
                                      },
                                    ],
                                    optional: false,
                                  },
                                  property: {
                                    type: 'Identifier',
                                    name: 'controller',
                                  },
                                  computed: false,
                                  optional: false,
                                },
                                arguments: [
                                  {
                                    type: 'Literal',
                                    raw: "'todoCtrl'",
                                    value: 'todoCtrl',
                                  },
                                  {
                                    type: 'Identifier',
                                    name: 'TodoCtrl',
                                  },
                                ],
                                optional: false,
                              },
                              property: {
                                type: 'Identifier',
                                name: 'directive',
                              },
                              computed: false,
                              optional: false,
                            },
                            arguments: [
                              {
                                type: 'Literal',
                                raw: "'todoBlur'",
                                value: 'todoBlur',
                              },
                              {
                                type: 'Identifier',
                                name: 'todoBlur',
                              },
                            ],
                            optional: false,
                          },
                          property: {
                            type: 'Identifier',
                            name: 'directive',
                          },
                          computed: false,
                          optional: false,
                        },
                        arguments: [
                          {
                            type: 'Literal',
                            raw: "'todoFocus'",
                            value: 'todoFocus',
                          },
                          {
                            type: 'Identifier',
                            name: 'todoFocus',
                          },
                        ],
                        optional: false,
                      },
                      property: {
                        type: 'Identifier',
                        name: 'directive',
                      },
                      computed: false,
                      optional: false,
                    },
                    arguments: [
                      {
                        type: 'Literal',
                        raw: "'todoEscape'",
                        value: 'todoEscape',
                      },
                      {
                        type: 'Identifier',
                        name: 'todoEscape',
                      },
                    ],
                    optional: false,
                  },
                  property: {
                    type: 'Identifier',
                    name: 'service',
                  },
                  computed: false,
                  optional: false,
                },
                arguments: [
                  {
                    type: 'Literal',
                    raw: "'todoStorage'",
                    value: 'todoStorage',
                  },
                  {
                    type: 'Identifier',
                    name: 'TodoStorage',
                  },
                ],
                optional: false,
              },
            },
          ],
        },
      },
    ],
  };

  await client.post('/ast').send(data);

  const res = await client.get('/tree');

  expect(res.status).toEqual(200);
  expect(res.body).toEqual([
    {
      fileName: '/js/Application.ts',
      methods: [{ name: 'todomvc', params: ['TodoStorage'] }],
    },
  ]);
});
