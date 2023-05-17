process.env.NODE_ENV = "development";

require('dotenv').config();
require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);

const HTTPStatus = require("http-status");


const photoUtil = require("@utils/create-photo");
const locationUtil = require("@utils/create-location");
const photoSchema = require("@models/Photo");
const cloudinary = require("@config/cloudinary");
const generateFilter = require("@utils/generate-filter");

const stubValue = {
  device_name: faker.name.findName(),
  network: faker.datatype.string(),
  device_id: faker.datatype.uuid(),
  device_number: {},
  image_url: faker.image.imageUrl(),
  image_code: faker.datatype.string(),
  description: faker.lorem.sentence(),
  tags: [faker.datatype.string(), faker.datatype.string()],
  metadata: {
    public_id: faker.datatype.uuid(),
    version: faker.datatype.number(),
    signature: faker.datatype.string(),
    width: faker.datatype.number(),
    height: faker.datatype.number(),
    format: faker.datatype.string(),
    resource_type: faker.datatype.string(),
    created_at: faker.date.past(),
    bytes: faker.datatype.number(),
    type: faker.datatype.string(),
    url: faker.internet.url(),
    secure_url: faker.internet.url(),
  },
};

describe("Photo Util", () => {
    let request;
    beforeEach(() => {
        sinon.restore();
        request = {
        query: { tenant: 'test' },
        body: {
            path: "",
            resource_type: "",
            device_name: stubValue.device_name,
        },
    }
    });
    describe("create", () => {
        
        it("should create a photo successfully", async () => {
            sinon.stub(photoUtil, "createPhotoOnCloudinary").returns({
                success: true,
                message: "successfully uploaded the media",
                data: stubValue,
                status: HTTPStatus.OK,
            });
            sinon.stub(photoUtil, "createPhotoOnPlatform").returns({
                success: true,
                message: "successfully created the photo",
                status: HTTPStatus.OK,
                data: stubValue,
            });
            let response = await photoUtil.create(request);
            expect(response.success).to.equal(true);

        });
    });

    describe("Update", () => {
        
        it("should update a photo successfully", async () => {
            sinon.stub(photoUtil, "updatePhotoOnCloudinary").returns({
                success: true,
                message: "successfully uploaded the media",
                data: stubValue,
                status: HTTPStatus.OK,
            });
            sinon.stub(photoUtil, "updatePhotoOnPlatform").returns({
                success: true,
                message: "successfully updated the photo",
                status: HTTPStatus.OK,
                data: stubValue,
            });
            let response = await photoUtil.update(request);
            expect(response.success).to.equal(true);

        });
        
        it('should return an error response on failure', async () => {
            const request = {};
            sinon.stub(photoUtil, 'createPhotoOnCloudinary').throws(new Error('Internal Server Error'));

            const result = await photoUtil.create(request);

            expect(photoUtil.createPhotoOnCloudinary.calledOnceWith(request)).to.be.true;
            expect(result).to.deep.equal({
                success: false,
                message: 'Internal Server Error',
                "errors": {
                    "message": "Internal Server Error"
                },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
            });
        });
    });

    describe('extractPhotoDetails', () => {
        afterEach(() => {
            sinon.restore();
        });
    
        it('should successfully extract photo Details', async () => {
            const request = { someParam: 'someValue' };
            const listResponse = {
                success: true,
                data: [{ id: 1 }],
                message: 'List request successful',
            };
            const listStub = sinon.stub(photoUtil, 'list').resolves(listResponse);

            const result = await photoUtil.extractPhotoDetails(request);

            assert.deepEqual(result, {
                success: true,
                data: { id: 1 },
                message: 'successfully extracted photo details',
            });
            sinon.assert.calledOnceWithExactly(listStub, request);
        });

        it('should return an error if list request fails', async () => {
            const listError = {
                success: false,
                message: 'List request failed',
                errors: {},
            };
            const listStub = sinon.stub(photoUtil, 'list').resolves(listError);

            const result = await photoUtil.extractPhotoDetails(request);

            assert.deepEqual(result, listError);
            sinon.assert.calledOnceWithExactly(listStub, request);
        });


        it('should return an error if an exception is thrown', async () => {
            const error = new Error('Internal Server Error');
            const listStub = sinon.stub(photoUtil, 'list').rejects(error);

            const result = await photoUtil.extractPhotoDetails(request);

            assert.deepEqual(result, {
                success: false,
                message: 'Internal Server Error',
                errors: { message: error.message },
            });
            sinon.assert.calledOnceWithExactly(listStub, request);
        });
    });

    describe('delete', () => {
        afterEach(() => {
            sinon.restore();
        });

        it('should return an error if extractPhotoDetails returns an error', async () => {
            const extractPhotoDetailsError = {
                success: false,
                message: 'Extract photo details failed',
                errors: {},
            };
            const extractPhotoDetailsStub = sinon.stub(photoUtil, 'extractPhotoDetails').resolves(extractPhotoDetailsError);

            const result = await photoUtil.delete(request);

            assert.deepEqual(result, extractPhotoDetailsError);
            sinon.assert.calledOnceWithExactly(extractPhotoDetailsStub, request);
        });

        it('should delete the photo and return the result', async () => {
            const extractPhotoDetailsResponse = {
                success: true,
                data: stubValue,
                message: 'Extracted photo details',
            };
            const extractPhotoDetailsStub = sinon.stub(photoUtil, 'extractPhotoDetails').resolves(extractPhotoDetailsResponse);
            const deletePhotoOnCloudinaryResponse = {
                success: true,
                message: 'Photo deleted on Cloudinary',
            };
            const deletePhotoOnCloudinaryStub = sinon.stub(photoUtil, 'deletePhotoOnCloudinary').resolves(deletePhotoOnCloudinaryResponse);
            const deletePhotoOnPlatformResponse = {
                success: true,
                message: 'Photo deleted on Platform',
            };
            const deletePhotoOnPlatformStub = sinon.stub(photoUtil, 'deletePhotoOnPlatform').resolves(deletePhotoOnPlatformResponse);

            const result = await photoUtil.delete(request);

            assert.deepEqual(result, deletePhotoOnPlatformResponse);
            sinon.assert.calledOnceWithExactly(extractPhotoDetailsStub, request);
            sinon.assert.calledOnceWithExactly(deletePhotoOnPlatformStub, request);
        });

        it('should return an error if an exception is thrown', async () => {
            const error = new Error('Something went wrong');
            const extractPhotoDetailsStub = sinon.stub(photoUtil, 'extractPhotoDetails').throws(error);

            const result = await photoUtil.delete(request);

            assert.deepEqual(result, {
                success: false,
                message: 'Internal Server Error',
                errors: {
                    message: "Something went wrong"
                },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
            });
        });

    });
    describe("List", () => {
        beforeEach(() => {
            sinon.restore();
        });
        request = {
            query: {
                tenant: 'airqo',
                limit: '10',
                skip: '0',
            },
        };

        it('should return the list of photos', async () => {
            const listPhotosResponse = {
                success: true,
                data: [stubValue],
                message: 'List request successful',
            };
            sinon.stub(generateFilter, "photos").returns(stubValue);
            sinon.stub(photoSchema.statics, "list").returns(listPhotosResponse);
            response = await photoUtil.list(request);
            expect(response).to.deep.equal(listPhotosResponse);
        });

        it('should return an error if an exception is thrown', async () => {
            const error = new Error('Something went wrong');
            sinon.stub(generateFilter, "photos").throws(error);

            const result = await photoUtil.list(request);

            assert.deepEqual(result, {
                success: false,
                message: 'Internal Server Error',
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
                errors: { message: error.message },
            });
        });

    });

    describe('getLastPath', () => {
        it('should remove the file extension and return the last path segment', () => {
            const request = {
                imageURL: 'https://example.com/images/photo.jpg',
            };
            const expectedResult = {
                success: true,
                data: 'photo',
                status: HTTPStatus.OK,
                message: 'successfully removed the file extension',
            };

            const result = photoUtil.getLastPath(request);
            assert.deepEqual(result, expectedResult);
        });

        it('should return an error if an exception is thrown', () => {
            const request = {
                iwrongProperty: '12S',
            };
            const error = new Error('Something went wrong');

            const result = photoUtil.getLastPath(request);
            assert.equal(result.success, false);
            assert.equal(result.message, 'Internal Server Error');
            assert.equal(result.status, HTTPStatus.INTERNAL_SERVER_ERROR);
        });
    });
    
    describe('extractImageIds', () => {
        it('should extract the image IDs from the image URLs', () => {
            const request = {
                body: {
                    image_urls: [
                        'https://example.com/images/photo1.jpg',
                        'https://example.com/images/photo2.jpg',
                    ],
                },
                query: {
                    device_name: 'device1',
                },
            };
            const expectedResult = {
                success: true,
                data: [
                    'devices/device1/photo1',
                    'devices/device1/photo2',
                ],
                status: HTTPStatus.OK,
                message: "successfully extracted the Image Ids"

            };

            const result = photoUtil.extractImageIds(request);

            assert.deepEqual(result, expectedResult);
        });

        it('should return an error if unable to extract the last path', () => {
            const request = {
                body: {
                    image_urls: [
                        'https://example.com/images/photo1.jpg',
                        'https://example.com/images/photo2.jpg',
                    ],
                },
                query: {
                    device_name: 'device1',
                },
            };
            const errorResponse = {
                success: false,
                message: 'Internal Server Error',
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
                errors: { message: 'Something went wrong' },
            };

            const getLastPath = sinon.stub(photoUtil, 'getLastPath');
            getLastPath.onFirstCall().returns(errorResponse);

            const result = photoUtil.extractImageIds(request);

            assert.equal(result.success, false);
            assert.equal(result.message, 'Internal Server Error');
            assert.equal(result.status, HTTPStatus.INTERNAL_SERVER_ERROR);

            getLastPath.restore();
        });
    });

    describe('createPhotoOnCloudinary', () => {
        afterEach(() => {
            sinon.restore();
        });

        request = {
            body: {
                path: 'path/img.jpg',
                resource_type: 'image',
                device_name: stubValue.device_name,
            },
        };
        it('should upload the image to Cloudinary and return a success response', async () => {

            const cloudinaryUploadStub = sinon.stub(cloudinary.uploader, 'upload')
                .returns({
                    success: true,
                    message: "successfully uploaded the media",
                    data: stubValue,
                    status: HTTPStatus.OK,
                });

            const expectedResult = {
                success: true,
                message: "successfully uploaded the media",
                data: stubValue,
                status: HTTPStatus.OK,
            };

            const result = await photoUtil.createPhotoOnCloudinary(request);

            assert.deepStrictEqual(result, expectedResult);
            sinon.assert.calledOnce(cloudinaryUploadStub);
        });

        it('should handle an error during the image upload and return an error response', async () => {

            const cloudinaryUploadStub = sinon.stub(cloudinary.uploader, 'upload')
                .returns({
                    success: false,
                    message: "Internal Server Error",
                    status: HTTPStatus.INTERNAL_SERVER_ERROR,
                    errors: {
                        message: "error message",
                    },
                });

            const result = await photoUtil.createPhotoOnCloudinary(request);

            assert.equal(result.success, false);
            assert.equal(result.message, 'Internal Server Error');
            assert.equal(result.status, HTTPStatus.INTERNAL_SERVER_ERROR);
            sinon.assert.calledOnce(cloudinaryUploadStub);
        });
    });


  
});