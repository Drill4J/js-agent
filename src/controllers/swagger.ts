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

export const apiDocs = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(spec);
};
