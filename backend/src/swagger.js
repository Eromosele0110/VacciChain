const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VacciChain Backend API',
      version: '1.0.0',
      description: 'Blockchain-based vaccination records on Stellar — soulbound, verifiable, tamper-proof.',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'http://backend:4000',
        description: 'Docker server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        // Standard error shape (#42) — see docs/api-errors.md.
        Error: {
          type: 'object',
          required: ['error', 'code'],
          properties: {
            error: {
              type: 'string',
              description: 'Safe, human-readable message. Always generic for 5xx.',
            },
            code: {
              type: 'string',
              description: 'Stable machine-readable code clients should branch on.',
              enum: [
                'VALIDATION_FAILED',
                'UNAUTHENTICATED',
                'TOKEN_INVALID',
                'FORBIDDEN',
                'NOT_FOUND',
                'RATE_LIMITED',
                'RPC_ERROR',
                'INTERNAL_ERROR',
              ],
            },
            requestId: {
              type: 'string',
              description: 'Correlates the response with server logs (also sent as X-Request-ID).',
            },
            details: {
              description: 'Optional field-level validation details (4xx only).',
            },
          },
        },
        VaccinationRecord: {
          type: 'object',
          properties: {
            vaccine_name: {
              type: 'string',
            },
            date_administered: {
              type: 'string',
              format: 'date-time',
            },
            issuer: {
              type: 'string',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, 'routes', '*.js'), path.join(__dirname, 'routes', 'docs', '*.js')],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
