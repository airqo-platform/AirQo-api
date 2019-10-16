const express = require('express');
const router = express.Router();
const joinController = require('../controllers/join');
const validate = require('express-validation');
const userValidation = require('../utils/validations');
const { authLocal, authJWT } = require('../services/auth');

//the middleware function
const middleware = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    next();
}
router.use(middleware);

router.get('/users', authJWT, joinController.listAll);

router.get('/usersOne', authJWT, joinController.listOne);

router.post('/register', validate(userValidation.register), joinController.register);

router.post('/login', authLocal, joinController.login);

router.put('/user/update', authJWT, joinController.update);


module.exports = router;