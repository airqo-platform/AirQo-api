process.env.NODE_ENV = "development";
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const assert = require("assert");
const joinController = require("../join");

const stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "airqo",
  firstName: faker.name.findName(),
  lastName: faker.name.findName(),
  userName: faker.internet.userName(),
  password: faker.internet.password(),
  emailConfirmed: faker.datatype.boolean(),
  isActive: faker.datatype.boolean(),
  email: faker.internet.email(),
  jobTitle: faker.name.jobTitle(),
  website: faker.internet.url(),
  duration: faker.date.future(),
  privilege: faker.name.jobType(),
  country: faker.address.country(),
  notifications: faker.random.objectElement(),
  resetPassword: faker.random.alphaNumeric(),
  resetPasswordExpires: faker.date.future(),
  organization: faker.company.companyName(),
  description: faker.name.jobDescriptor(),
  phoneNumber: faker.phone.phoneNumber(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  password: faker.internet.password(),
  profilePicture: faker.image.imageUrl(),
};

describe("join controller", function () {
  describe("register user", function () {
    let status, json, res, joinController, joinUtil;
    beforeEach(async () => {
      status = sinon.stub();
      json = sinon.spy();
      res = { json, status };
      status.returns(res);
      const userModel = sinon.spy();
      joinUtil = await joinUtil.register(userModel);
    });

    it("should register a user when all the required parameters are provided", async function () {
      const req = {
        body: {
          firstName: faker.name.firstName(),
        },
      };
      const stubValue = {
        _id: faker.datatype.uuid(),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.past(),
      };
      const stub = sinon.stub(joinUtil, "create").returns(stubValue);
      await joinController.create(req, res);
      expect(stub.calledOnce).to.be.true;
      expect(status.calledOnce).to.be.true;
    });
  });
});

describe("list users", function () {
  let req;
  let res;
  let joinUtil;
  beforeEach(() => {
    req = { params: { _id: faker.datatype.uuid() } };
    res = { json: function () {} };
    const UserModel = sinon.spy();
  });
  it("should retrieve a User when all required parameters are provided", async function () {
    const stubValue = {
      _id: faker.datatype.uuid(),
      firstName: faker.name.firstName(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.past(),
    };
    const mock = sinon.mock(res);
    mock.expects("json").once().withExactArgs({ data: stubValue });
    const stub = sinon.stub(joinUtil, "list users").returns(stubValue);
    userController = new UserController(userService);
    const join = await joinController.list(req, res);
    expect(stub.calledOnce).to.be.true;
    mock.verify();
  });
});
