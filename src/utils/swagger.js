const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'NounX Community API',
            version: '1.0.0',
            description: 'API documentation for the NounX Community Chat platform',
        },
        servers: [
            {
                url: 'http://lightpink-lark-246190.hostingersite.com',
                description: 'Production server',
            },
            {
                url: 'http://localhost:4000',
                description: 'Local development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/routes/*.js', './src/controllers/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = {
    swaggerUi,
    specs,
};
