require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const {
  attachIdentityContext,
} = require("@middleware/identity-context.middleware");

const { expect } = chai;

describe("attachIdentityContext", () => {
  it("should parse single-value headers into req.identity", () => {
    const req = {
      headers: {
        "x-auth-user-id": "user1",
        "x-auth-user-groups": "orgA, orgB",
      },
    };
    const next = sinon.stub();
    attachIdentityContext(req, {}, next);
    expect(req.identity).to.deep.equal({
      userId: "user1",
      groups: ["orgA", "orgB"],
    });
    expect(next.calledOnce).to.be.true;
  });

  it("should default to empty identity when headers are absent", () => {
    const req = { headers: {} };
    const next = sinon.stub();
    attachIdentityContext(req, {}, next);
    expect(req.identity).to.deep.equal({ userId: null, groups: [] });
    expect(next.calledOnce).to.be.true;
  });

  it("should not throw and should normalize array-valued headers", () => {
    const req = {
      headers: {
        "x-auth-user-id": ["user1", "user2"],
        "x-auth-user-groups": ["orgA", "orgB"],
      },
    };
    const next = sinon.stub();
    expect(() => attachIdentityContext(req, {}, next)).to.not.throw();
    expect(req.identity).to.deep.equal({
      userId: "user1",
      groups: ["orgA", "orgB"],
    });
    expect(next.calledOnce).to.be.true;
  });
});
