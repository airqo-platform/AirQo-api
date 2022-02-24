"use-strict";
const { expect } = require('chai');
const request = require('supertest');
const { describe, it } = require('mocha');

const app = require('../../app');

describe('device-registry default metrics',  () => {
  it('default metrics response status is 200', async () => {
    const response = await request(app).get('/metrics')
    expect(response.status).to.equal(200);
  });
});