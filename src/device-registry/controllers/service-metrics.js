const promClient = require('prom-client')
const register = new promClient.Registry()
const { tryCatchErrors  } = require("../utils/errors");

const metrics = {
  default: async (req, res) => {
    try{
        // Setting default label
        register.setDefaultLabels({ app: 'device-registry-api'  })
        // Enabling collection of default metrics
        promClient.collectDefaultMetrics({ register })

        res.setHeader('Content-Type', register.contentType);
        res.status(200).send(await register.metrics());
    }catch(err){        
      tryCatchErrors(res, err, 'Something went wrong');
    }
  },
};

module.exports = metrics;
