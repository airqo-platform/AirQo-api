require("module-alias/register");
process.env.NODE_ENV = "development";
const chai = require("chai");
const expect = chai.expect;
const {
  findLowestLevelGrids,
  selectDevices,
} = require("@utils/public-cohort.util");

const site = (_id, grids) => ({ _id, grids });
const device = (_id, site_id) => ({ _id, site_id });

describe("public-cohort.util", () => {
  describe("findLowestLevelGrids", () => {
    it("drops grids that contain a smaller grid", () => {
      const lowest = findLowestLevelGrids([
        site("s1", ["country", "cityA"]),
        site("s2", ["country", "cityA"]),
        site("s3", ["country", "cityB"]),
        site("s4", ["country"]),
      ]);
      expect([...lowest.keys()].sort()).to.deep.equal(["cityA", "cityB"]);
    });

    it("keeps overlapping grids that are not nested, and identical ones", () => {
      const lowest = findLowestLevelGrids([
        site("s1", ["a", "twinOne", "twinTwo"]),
        site("s2", ["a", "b", "twinOne", "twinTwo"]),
        site("s3", ["b"]),
        site("s4", []),
      ]);
      expect([...lowest.keys()].sort()).to.deep.equal([
        "a",
        "b",
        "twinOne",
        "twinTwo",
      ]);
    });
  });

  describe("selectDevices", () => {
    const grids = (sites) => findLowestLevelGrids(sites);

    it("caps each grid and leaves short grids under-represented", () => {
      const { selected, grids: summary } = selectDevices({
        lowestLevelGrids: grids([
          site("s1", ["big"]),
          site("s2", ["small"]),
        ]),
        eligibleDevices: [
          device("d1", "s1"),
          device("d2", "s1"),
          device("d3", "s1"),
          device("d4", "s2"),
        ],
        currentMemberIds: new Set(),
        devicesPerGrid: 2,
      });
      expect(selected.size).to.equal(3);
      expect(selected.has("d4")).to.equal(true);
      const byId = Object.fromEntries(summary.map((g) => [g.grid_id, g]));
      expect(byId.big.selected_devices).to.equal(2);
      expect(byId.small.selected_devices).to.equal(1);
    });

    it("retains current members that are still eligible", () => {
      const { selected } = selectDevices({
        lowestLevelGrids: grids([site("s1", ["g"])]),
        eligibleDevices: ["d1", "d2", "d3", "d4", "d5", "d6"].map((id) =>
          device(id, "s1"),
        ),
        // "gone" is no longer eligible, so it is not in eligibleDevices
        currentMemberIds: new Set(["d2", "d5", "gone"]),
        devicesPerGrid: 3,
      });
      expect(selected.size).to.equal(3);
      expect(selected.has("d2")).to.equal(true);
      expect(selected.has("d5")).to.equal(true);
      expect(selected.has("gone")).to.equal(false);
    });

    it("never selects a device twice across overlapping grids", () => {
      const { selected, grids: summary } = selectDevices({
        lowestLevelGrids: grids([
          site("s1", ["a", "b"]),
          site("s2", ["a"]),
          site("s3", ["b"]),
        ]),
        eligibleDevices: [
          device("d1", "s1"),
          device("d2", "s1"),
          device("d3", "s2"),
          device("d4", "s3"),
        ],
        currentMemberIds: new Set(["d1", "d2"]),
        devicesPerGrid: 2,
      });
      // d1 and d2 sit in both grids and already fill each grid's quota
      expect([...selected].sort()).to.deep.equal(["d1", "d2"]);
      summary.forEach((g) => expect(g.selected_devices).to.equal(2));
    });
  });
});
