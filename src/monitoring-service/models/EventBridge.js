const EventEmitter = require('events');
let config = require('config');
let microserviceConfig = config.get('microservice.config');

//this just checks the condition of other services and send out alerts

let EventEngine = function () {
    this.event = new EventEmitter();
    this.eventLoopInterval = 10000;
}

EventEngine.prototype.Start = function () {
    var that = this;
    console.log('starting the event engine');
    console.log('-----------------------------------------');
    console.log('monitoring the following services');
    console.log('-----------------------------------------');
    console.log(microserviceConfig.services);
    console.log('-----------------------------------------');

    setInterval(function () {
        try {
            const promises = that.GetStatus(microserviceConfig.services);

            Promise.all(promises).then(function (values) {
                for (var i = 0; i < values.length; i++) {
                    var value = values[i];

                    if (value.address && value.port) {
                        console.log('-----------------------------------------');
                        console.log("Address and Port Result");
                        console.log(value.address + ":" + value.port);
                        message = "service is up";

                        if (!value.success) {
                            message = "Service is DOWN";
                            var service;
                            for (var j = 0; j < microserviceConfig.services.length; j++) {
                                if (microserviceConfig.services[j].address == value.address &&
                                    microserviceConfig.services[j].port == value.port) {

                                    service = microserviceConfig.services[j];
                                }
                            }
                        }
                        console.log(message);
                        console.log("-----------------------------------------")
                    }
                }
            }).catch(function (err) {
                console.log(err);
            })
        }
        catch (e) {
            console.log("failed interval");
            console.log(e)
        }
    }, this.eventLoopInterval);
};


//getting the status of each service
EventEngine.prototype.GetStatus = function (services) {
    var promises = [];

    for (var i = 0; i < services.length; i++) {
        var url = "http://" + services[i].address + ":" + services[i].port + "/hearbeat";
        promises.push(this.GetMicroserviceData(url, services[i]));
    }
    return promises;
}

//alerting upon service failure
EventEngine.prototype.SendAlert = function (service) {
    console.log('sending an SMS alert');

    return new Promise(function (fulfill, reject) {

        var post_data = {
            message: service.name + "-" + service.address + ":" + service.port + "is down."
        }

        var post_options = {
            hostname: microserviceConfig.alerting.address,
            port: microserviceConfig.alerting.port,
            path: microserviceConfig.alerting.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        var request = http.request(post_options, function (res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }

            var body = [];
            res.on("data", function (chunk) {
                body.push(chunk);
            });

            res.on("end", () => {
                try {
                    body = JSON.parse(body.join('').toString());
                }
                catch (e) {
                    reject(e);
                }
                fulfill(body);
            });
        });

        request.on("error", function () {
            reject(err);
        });


    })

}




