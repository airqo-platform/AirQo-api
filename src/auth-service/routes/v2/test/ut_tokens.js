require("module-alias/register");
const request = require("supertest");
const router = require("@routes/tokens");
const {
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
} = require("@validators/token.validators");

describe("Tokens Router", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /", () => {
    it("should list all tokens", async () => {
      const res = await request(app)
        .get("/")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("POST /", () => {
    it("should create a new token", async () => {
      const res = await request(app)
        .post("/")
        .send({
          /* token details */
        })
        .set("Authorization", "Bearer valid-token")
        .expect(201);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("PUT /:token/regenerate", () => {
    it("should regenerate a token", async () => {
      const res = await request(app)
        .put("/valid-token/regenerate")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("DELETE /:token", () => {
    it("should delete a token", async () => {
      const res = await request(app)
        .delete("/valid-token")
        .set("Authorization", "Bearer valid-token")
        .expect(204);
    });
  });

  describe("GET /:token", () => {
    it("should verify a token", async () => {
      const res = await request(app)
        .get("/valid-token")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("GET /expired", () => {
    it("should list expired tokens", async () => {
      const res = await request(app)
        .get("/expired")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("GET /expiring", () => {
    it("should list expiring tokens", async () => {
      const res = await request(app)
        .get("/expiring")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("GET /unknown-ip", () => {
    it("should list tokens with unknown IPs", async () => {
      const res = await request(app)
        .get("/unknown-ip")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("POST /blacklist-ip", () => {
    it("should blacklist a single IP", async () => {
      const res = await request(app)
        .post("/blacklist-ip")
        .send({ ip: "192.168.1.1" })
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("POST /blacklist-ips", () => {
    it("should blacklist multiple IPs", async () => {
      const res = await request(app)
        .post("/blacklist-ips")
        .send([{ ip: "192.168.1.1" }, { ip: "192.168.1.2" }])
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("DELETE /blacklist-ip/:ip", () => {
    it("should remove a blacklisted IP", async () => {
      const res = await request(app)
        .delete("/blacklist-ip/192.168.1.1")
        .set("Authorization", "Bearer valid-token")
        .expect(204);
    });
  });

  describe("GET /blacklist-ip", () => {
    it("should list blacklisted IPs", async () => {
      const res = await request(app)
        .get("/blacklist-ip")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("POST /blacklist-ip-range", () => {
    it("should blacklist an IP range", async () => {
      const res = await request(app)
        .post("/blacklist-ip-range")
        .send({ range: "192.168.0.0-192.168.255.255" })
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("POST /blacklist-ip-range/bulk", () => {
    it("should bulk insert blacklisted IP ranges", async () => {
      const res = await request(app)
        .post("/blacklist-ip-range/bulk")
        .send([
          { range: "192.168.0.0-192.168.255.255" },
          { range: "10.0.0.0-10.255.255.255" },
        ])
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("DELETE /blacklist-ip-range/:id", () => {
    it("should remove a blacklisted IP range", async () => {
      const res = await request(app)
        .delete("/blacklist-ip-range/valid-id")
        .set("Authorization", "Bearer valid-token")
        .expect(204);
    });
  });

  describe("GET /blacklist-ip-range", () => {
    it("should list blacklisted IP ranges", async () => {
      const res = await request(app)
        .get("/blacklist-ip-range")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("POST /whitelist-ip", () => {
    it("should whitelist a single IP", async () => {
      const res = await request(app)
        .post("/whitelist-ip")
        .send({ ip: "192.168.1.1" })
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("POST /bulk-whitelist-ip", () => {
    it("should bulk whitelist IPs", async () => {
      const res = await request(app)
        .post("/bulk-whitelist-ip")
        .send([{ ip: "192.168.1.1" }, { ip: "192.168.1.2" }])
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("DELETE /whitelist-ip/:ip", () => {
    it("should remove a whitelisted IP", async () => {
      const res = await request(app)
        .delete("/whitelist-ip/192.168.1.1")
        .set("Authorization", "Bearer valid-token")
        .expect(204);
    });
  });

  describe("GET /whitelist-ip", () => {
    it("should list whitelisted IPs", async () => {
      const res = await request(app)
        .get("/whitelist-ip")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("POST /ip-prefix", () => {
    it("should add an IP prefix", async () => {
      const res = await request(app)
        .post("/ip-prefix")
        .send({ prefix: "/24" })
        .set("Authorization", "Bearer valid-token")
        .expect(201);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("POST /ip-prefix/bulk", () => {
    it("should bulk add IP prefixes", async () => {
      const res = await request(app)
        .post("/ip-prefix/bulk")
        .send([{ prefix: "/24" }, { prefix: "/16" }])
        .set("Authorization", "Bearer valid-token")
        .expect(201);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("DELETE /ip-prefix/:id", () => {
    it("should remove an IP prefix", async () => {
      const res = await request(app)
        .delete("/ip-prefix/valid-id")
        .set("Authorization", "Bearer valid-token")
        .expect(204);
    });
  });

  describe("GET /ip-prefix", () => {
    it("should list IP prefixes", async () => {
      const res = await request(app)
        .get("/ip-prefix")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("POST /blacklist-ip-prefix", () => {
    it("should blacklist an IP prefix", async () => {
      const res = await request(app)
        .post("/blacklist-ip-prefix")
        .send({ prefix: "/24" })
        .set("Authorization", "Bearer valid-token")
        .expect(201);

      expect(res.body).toHaveProperty("id");
    });
  });

  describe("POST /blacklist-ip-prefix/bulk", () => {
    it("should bulk insert blacklisted IP prefixes", async () => {
      const res = await request(app)
        .post("/blacklist-ip-prefix/bulk")
        .send([{ prefix: "/24" }, { prefix: "/16" }])
        .set("Authorization", "Bearer valid-token")
        .expect(201);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe("DELETE /blacklist-ip-prefix/:id", () => {
    it("should remove a blacklisted IP prefix", async () => {
      const res = await request(app)
        .delete("/blacklist-ip-prefix/valid-id")
        .set("Authorization", "Bearer valid-token")
        .expect(204);
    });
  });

  describe("GET /blacklist-ip-prefix", () => {
    it("should list blacklisted IP prefixes", async () => {
      const res = await request(app)
        .get("/blacklist-ip-prefix")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  // Add more test cases as needed for other routes
});
