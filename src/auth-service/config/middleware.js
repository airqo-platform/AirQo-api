const morgan = require('morgan');
const bodyParser = require('body-parser')
const compression = require('compression')
const helmet = require('helmet')
const passport = require('passport');

const {
    isPrimitive
} = require('util')

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

//we export a middleware funtion which takes in the express application as the input

module.exports = app => {
    if (isProd) {
        app.use(compression());
        app.use(helmet());
    }
    app.use(passport.initialize());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));


    if (isDev) {
        app.use(morgan('dev'));
    }
}