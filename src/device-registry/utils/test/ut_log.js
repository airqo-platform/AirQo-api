process.env.NODE_ENV = "development";

require('dotenv').config();
require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);

const { logText, logElement, logObject, logError } = require('@utils/log');

describe('Logging Functions', function() {
  beforeEach(function() {
    sinon.spy(console, 'log');
    sinon.spy(console, 'dir');
    sinon.spy(console, 'error');
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('logText', function() {
    it('should log the message when not in production', function() {
      process.env.NODE_ENV = 'development';
      const message = 'This is a log message';
      const result = logText(message);
      expect(console.log.calledOnceWith(message)).to.be.true;
      expect(result).to.equal('log deactivated in prod and stage');
    });

    it('should not log the message when in production', function() {
      process.env.NODE_ENV = 'production';
      const message = 'This is a log message';
      const result = logText(message);
      expect(console.log.called).to.be.false;
      expect(result).to.equal('log deactivated in prod and stage');
    });
  });

  describe('logElement', function() {
    it('should log the message and body when not in production', function() {
      process.env.NODE_ENV = 'development';
      const message = 'Element';
      const body = { id: 1, name: 'Test' };
      const result = logElement(message, body);
      expect(console.log.calledOnceWith(`${message}: ${body}`)).to.be.true;
      expect(result).to.equal('log deactivated in prod and stage');
    });

    it('should not log the message and body when in production', function() {
      process.env.NODE_ENV = 'production';
      const message = 'Element';
      const body = { id: 1, name: 'Test' };
      const result = logElement(message, body);
      expect(console.log.called).to.be.false;
      expect(result).to.equal('log deactivated in prod and stage');
    });
  });

  describe('logObject', function() {
    it('should log the message and object when not in production', function() {
      process.env.NODE_ENV = 'development';
      const message = 'Object';
      const object = { id: 1, name: 'Test' };
      const result = logObject(message, object);
      expect(console.log.calledOnceWith(`${message}: `)).to.be.true;
      expect(console.dir.calledOnceWith(object)).to.be.true;
      expect(result).to.equal('log deactivated in prod and stage');
    });

    it('should not log the message and object when in production', function() {
      process.env.NODE_ENV = 'production';
      const message = 'Object';
      const object = { id: 1, name: 'Test' };
      const result = logObject(message, object);
      expect(console.log.called).to.be.false;
      expect(console.dir.called).to.be.false;
      expect(result).to.equal('log deactivated in prod and stage');
    });
  });

  describe('logError', function() {
    it('should log the error message when not in production', function() {
      process.env.NODE_ENV = 'development';
      const error = new Error('An error occurred');
      const result = logError(error);
      expect(console.error.calledOnceWith(error)).to.be.true;
      expect(result).to.equal('log deactivated in prod and stage');
    });

      it('should not log the error message when in production', function () {
        process.env.NODE_ENV = 'production';
        const error = new Error('An error occurred');
        const result = logError(error);
        expect(console.error.called).to.be.false;
        expect(result).to.equal('log deactivated in prod and stage');
      } 
      );
  });
});
