require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const admin = require("firebase-admin");
const constants = require("@config/constants");
const { db } = require("@config/firebase-admin");

describe("Firebase Admin Configuration and Firestore Database", () => {
  before(() => {
    // Stub the Firebase Admin initializeApp function.
    sinon.stub(admin, "initializeApp");
    // Stub the admin.firestore function.
    sinon.stub(admin, "firestore").returns({
      // Add any Firestore methods you may want to test.
      // For example: collection, doc, etc.
      // collection: () => {},
      // doc: () => {},
    });
  });

  after(() => {
    // Restore the original functions after the tests are done.
    sinon.restore();
  });

  describe("Firebase Admin Configuration", () => {
    it("should initialize the Firebase Admin app with the correct configuration", () => {
      expect(admin.initializeApp.calledOnce).to.be.true;
      const [config] = admin.initializeApp.args[0];
      expect(config.credential).to.exist;
      expect(config.credential).to.be.an.instanceof(
        admin.credential.ServiceAccount
      );
      expect(config.databaseURL).to.equal(constants.FIREBASE_DATABASE_URL);
      // Add more assertions for the configuration if needed.
    });
  });

  describe("Firestore Database", () => {
    it("should have a reference to the Firestore database", () => {
      expect(db).to.exist;
      expect(db).to.be.an.instanceof(admin.firestore.Firestore);
      // Add more assertions or test Firestore methods if needed.
    });
  });

  // Add more test cases to cover additional scenarios or Firestore methods.
});

// You can add more test cases to cover additional scenarios or Firestore methods.
