const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const HTTPStatus = require("http-status");
const errors = require("../errors");

describe("Errors Utility Functions", () => {
    describe("convertErrorArrayToObject", () => {
        it("should convert an array of errors to an object", () => {
            const errorArray = [
                { param: "field1", msg: "Field 1 is required" },
                { param: "field2", msg: "Field 2 must be a number" },
            ];

            const result = errors.convertErrorArrayToObject(errorArray);

            expect(result).to.deep.equal({
                field1: "Field 1 is required",
                field2: "Field 2 must be a number",
            });
        });
    });

    describe("errorResponse", () => {
        it("should send an error response with default status code", () => {
            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.spy(),
            };

            errors.errorResponse({ res, message: "An error occurred" });

            expect(res.status.calledWith(HTTPStatus.INTERNAL_SERVER_ERROR)).to.be.true;
            expect(res.json.calledWithMatch({
                success: false,
                message: "An error occurred",
                error: {
                    statusCode: HTTPStatus.INTERNAL_SERVER_ERROR,
                    message: "An error occurred",
                    error: {},
                },
            })).to.be.true;
        });

        it("should send an error response with a custom status code", () => {
            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.spy(),
            };

            errors.errorResponse({ res, message: "Bad request", statusCode: HTTPStatus.BAD_REQUEST });

            expect(res.status.calledWith(HTTPStatus.BAD_REQUEST)).to.be.true;
            expect(res.json.calledWithMatch({
                success: false,
                message: "Bad request",
                error: {
                    statusCode: HTTPStatus.BAD_REQUEST,
                    message: "Bad request",
                    error: {},
                },
            })).to.be.true;
        });
    });

    describe("badRequest", () => {
        it("should send a bad request response", () => {
            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.spy(),
            };

            errors.badRequest(res, "Bad request", { field: "Invalid input" });

            expect(res.status.calledWith(HTTPStatus.BAD_REQUEST)).to.be.true;
            expect(res.json.calledWithMatch({
                success: false,
                message: "Bad request",
                errors: { field: "Invalid input" },
            })).to.be.true;
        });
    });
});
