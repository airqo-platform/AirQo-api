const request = require("request");

var headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

const getData = async url => {
    try {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    }
    catch (error) {
        return error.json();
    }
}

module.exports = getData;