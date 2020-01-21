import { BaseController } from './base.controller';

import swaggerJSDoc from 'swagger-jsdoc';

export const spec = swaggerJSDoc({
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Drill4j JS agent',
      version: '1.0.0',
    },
  },
  apis: ['**/*.ts'],
});

// export class SwaggerControler extends BaseController {
//   public initRoutes(): void {
//     this.router.use(
//       '/api-docs',
//       swaggerUi.serve,
//       swaggerUi.setup(spec, {
//         explorer: true,
//       })
//     );

//     this.router.get('/api-docs.json', (req, res) => {
//       res.setHeader('Content-Type', 'application/json');
//       res.send(spec);
//     });
//   }
// }

export const apiDocs = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(spec);
};
