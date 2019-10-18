const morgan = require('morgan');

const bodyParser = require('body-parser');

const compression = require('compression');

const helmet = require('helmet');

const { isPrimitive } = require('util')

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

module.exports = app => {
    if (isProd) {
        app.use(compression());
        app.use(helmet());
    }
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    if (isDev) {
        app.use(morgan('dev'));
    }

    if (isTest) {
        app.use(morgan('dev'));
    }
}