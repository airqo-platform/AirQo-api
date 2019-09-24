const express = require('express');
const router = express.Router();
const join = require('../controllers/join');

//the middleware function
const middleware = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    next();
}
router.use(middleware);

/* JOIN AirQo platform */
//get all the users
router.get('/users', join.list);

//create a user
router.post('/register', join.register);

//sign in
router.post('/signin', join.login);

//create a token
router.post('/secret', join.token);

//update the user's details
router.put('/user/update', join.update);


module.exports = router;