require("module-alias/register");
const { expect } = require("chai");
const qs = require("qs");
const {
  buildPaginationQuery,
} = require("@utils/common/pagination-query.util");
const gridUtil = require("@utils/grid.util");

describe("buildPaginationQuery", () => {
  it("drops credential params (token, TOKEN, access_token, api_key, apikey, key)", () => {
    const result = buildPaginationQuery(
      {
        token: "secret-1",
        TOKEN: "secret-2",
        access_token: "secret-3",
        api_key: "secret-4",
        apiKey: "secret-5",
        key: "secret-6",
        network: "airqo",
      },
      { skip: 30, limit: 30 },
    );

    expect(result).to.deep.equal({ network: "airqo", skip: 30, limit: 30 });
  });

  it("keeps every non-credential param unchanged", () => {
    const query = { network: "airqo", category: "lowcost", search: "kampala" };
    expect(buildPaginationQuery(query)).to.deep.equal(query);
  });

  it("lets overrides replace the incoming skip/limit", () => {
    expect(
      buildPaginationQuery({ skip: "0", limit: "10" }, { skip: 10, limit: 10 }),
    ).to.deep.equal({ skip: 10, limit: 10 });
  });

  it("does not mutate the incoming query", () => {
    const query = { token: "secret", network: "airqo" };
    buildPaginationQuery(query, { skip: 5 });
    expect(query).to.deep.equal({ token: "secret", network: "airqo" });
  });

  it("handles a missing query", () => {
    expect(buildPaginationQuery(undefined, { limit: 5 })).to.deep.equal({
      limit: 5,
    });
  });
});

describe("pagination meta links never echo the API token", () => {
  it("grid list meta: nextPage/previousPage omit token but keep other params", () => {
    const request = {
      protocol: "https",
      get: () => "api.airqo.net",
      originalUrl: "/api/v2/devices/grids/summary?token=secret&network=airqo",
      query: { token: "secret", network: "airqo", skip: "10", limit: "10" },
    };

    const meta = gridUtil._buildGridListMeta({
      total: 50,
      _skip: 10,
      _limit: 10,
      request,
    });

    expect(meta.nextPage).to.be.a("string");
    expect(meta.previousPage).to.be.a("string");
    [meta.nextPage, meta.previousPage].forEach((link) => {
      expect(link).to.not.include("token");
      expect(link).to.not.include("secret");
    });

    const nextQuery = qs.parse(meta.nextPage.split("?")[1]);
    expect(nextQuery).to.deep.equal({
      network: "airqo",
      skip: "20",
      limit: "10",
    });
    expect(meta.nextPage.split("?")[0]).to.equal(
      "https://api.airqo.net/api/v2/devices/grids/summary",
    );
  });
});
