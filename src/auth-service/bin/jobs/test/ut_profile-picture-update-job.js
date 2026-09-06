require("module-alias/register");
const rewire = require("rewire");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;

const rewireProfilePictureUpdate = rewire("../profile-picture-update-job");
const updateProfilePictures = rewireProfilePictureUpdate.__get__(
  "updateProfilePictures"
);

// Builds a GroupModel("airqo") mock supporting
// .find(filter).sort().limit(n).select().lean(). Simulates the real
// behavior that matters for the pagination regression: a group with
// grp_profile_picture already set no longer matches the filter, so once
// updateGroupProfilePicture() "succeeds" for a group, it must not
// reappear in a later find() call in this test's fixture.
function makeGroupModelMock(allGroups) {
  const remaining = allGroups.map((g) => ({ ...g }));
  const findStub = sinon.stub().callsFake((filter) => {
    let matches = remaining.filter(
      (g) => !g.grp_profile_picture && (g._id || true)
    );
    if (filter && filter._id && filter._id.$gt) {
      matches = matches.filter((g) => g._id > filter._id.$gt);
    }
    return {
      sort: sinon.stub().returnsThis(),
      limit: sinon.stub().callsFake((n) => ({
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(matches.slice(0, n)),
      })),
    };
  });
  const findByIdAndUpdateStub = sinon.stub().callsFake((id) => {
    const group = remaining.find((g) => g._id === id);
    if (group) group.grp_profile_picture = "https://example.com/default.png";
    return Promise.resolve(group);
  });
  return {
    model: () => ({
      find: findStub,
      findByIdAndUpdate: findByIdAndUpdateStub,
    }),
    findStub,
    findByIdAndUpdateStub,
  };
}

describe("updateProfilePictures", () => {
  let origGroupModel;
  let origAcquireCronLock;
  let origLogger;
  let origLogText;
  let origLogObject;

  beforeEach(() => {
    origGroupModel = rewireProfilePictureUpdate.__get__("GroupModel");
    origAcquireCronLock = rewireProfilePictureUpdate.__get__(
      "acquireCronLock"
    );
    origLogger = rewireProfilePictureUpdate.__get__("logger");
    origLogText = rewireProfilePictureUpdate.__get__("logText");
    origLogObject = rewireProfilePictureUpdate.__get__("logObject");

    rewireProfilePictureUpdate.__set__(
      "acquireCronLock",
      sinon.stub().resolves(true)
    );
    rewireProfilePictureUpdate.__set__("logger", {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub(),
    });
    rewireProfilePictureUpdate.__set__("logText", sinon.stub());
    rewireProfilePictureUpdate.__set__("logObject", sinon.stub());
  });

  afterEach(() => {
    rewireProfilePictureUpdate.__set__("GroupModel", origGroupModel);
    rewireProfilePictureUpdate.__set__("acquireCronLock", origAcquireCronLock);
    rewireProfilePictureUpdate.__set__("logger", origLogger);
    rewireProfilePictureUpdate.__set__("logText", origLogText);
    rewireProfilePictureUpdate.__set__("logObject", origLogObject);
    sinon.restore();
  });

  it("processes every matching group across pages instead of skipping half of them", async () => {
    // 5 groups needing an update, with a batch size larger than the set
    // (BATCH_SIZE in the job is 100) so a single page would normally cover
    // them all — the regression only reproduces with more matches than fit
    // in one page, so this uses a mock filter that always re-evaluates
    // against remaining unset groups regardless of BATCH_SIZE.
    const groups = Array.from({ length: 5 }, (_, i) => ({
      _id: `g${i}`,
      grp_title: `Group ${i}`,
      grp_profile_picture: null,
    }));
    const { model, findByIdAndUpdateStub } = makeGroupModelMock(groups);
    rewireProfilePictureUpdate.__set__("GroupModel", model);
    rewireProfilePictureUpdate.__set__("BATCH_SIZE", 2);

    await updateProfilePictures();

    // Every group must have been updated exactly once — a skip-based
    // pagination bug would leave some groups untouched because they drop
    // out of the filter's matching set as earlier pages get processed.
    expect(findByIdAndUpdateStub.callCount).to.equal(5);
    const updatedIds = findByIdAndUpdateStub
      .getCalls()
      .map((c) => c.args[0])
      .sort();
    expect(updatedIds).to.deep.equal(["g0", "g1", "g2", "g3", "g4"]);
  });
});
