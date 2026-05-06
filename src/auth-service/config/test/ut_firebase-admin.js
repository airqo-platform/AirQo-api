require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();
const { expect } = chai;

describe("Firebase Admin Configuration", () => {
  let firebaseAdminModule;
  let initializeAppStub;
  let firestoreStub;
  let firestoreInstance;

  beforeEach(() => {
    initializeAppStub = sinon.stub();
    firestoreInstance = { collection: sinon.stub(), batch: sinon.stub() };
    firestoreStub = sinon.stub().returns(firestoreInstance);

    const adminStub = {
      credential: {
        cert: sinon.stub().returns({ type: "service_account" }),
      },
      firestore: firestoreStub,
    };

    const constantsStub = {
      FIREBASE_PROJECT_ID: "",
      FIREBASE_PRIVATE_KEY: "",
      FIREBASE_CLIENT_EMAIL: "",
      ENVIRONMENT: "TEST ENVIRONMENT",
    };

    firebaseAdminModule = proxyquire("@config/firebase-admin", {
      "firebase-admin": adminStub,
      "firebase-admin/app": { initializeApp: initializeAppStub },
      "./constants": constantsStub,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("when Firebase credentials are not configured", () => {
    it("should export db as null", () => {
      // proxyquire loads with empty constants — credentials absent by default
      expect(firebaseAdminModule.db).to.equal(null);
    });

    it("should export a getDb function", () => {
      expect(firebaseAdminModule.getDb).to.be.a("function");
    });

    it("getDb() should throw when db is null", () => {
      expect(() => firebaseAdminModule.getDb()).to.throw(
        "Firebase is not configured",
      );
    });
  });
});
