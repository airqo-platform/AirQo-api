require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const HTTPStatus = require("http-status");
const createPhoto = require("@utils/create-photo");
const expect = chai.expect;

describe("create-photo-util", () => {
  describe("createPhoto", () => {
    describe("create", () => {
      it("should create photo successfully", async () => {
        // Mock the request object with required properties for createPhoto
        const request = {
          body: {
            // Add required properties for creating photo on Cloudinary
          },
        };

        // Mock the response from createPhotoOnCloudinary
        const responseFromCreatePhotoOnCloudinary = {
          success: true,
          data: {
            // Add necessary data for testing further steps
          },
        };
        sinon
          .stub(createPhoto, "createPhotoOnCloudinary")
          .resolves(responseFromCreatePhotoOnCloudinary);

        // Mock the response from createPhotoOnPlatform
        const responseFromCreatePhotoOnPlatform = {
          success: true,
          data: {
            // Add necessary data for testing final response
          },
        };
        sinon
          .stub(createPhoto, "createPhotoOnPlatform")
          .resolves(responseFromCreatePhotoOnPlatform);

        // Call the function and assert
        const result = await createPhoto.create(request);

        expect(result.success).to.be.true;
        expect(result.data).to.exist;
        // Add more assertions based on the expected results of the create function
      });

      it("should handle errors during photo creation on Cloudinary", async () => {
        // Mock the request object with required properties for createPhoto
        const request = {
          body: {
            // Add required properties for creating photo on Cloudinary
          },
        };

        // Mock the response from createPhotoOnCloudinary with an error
        const errorFromCloudinary = new Error("Cloudinary error");
        const responseFromCreatePhotoOnCloudinary = {
          success: false,
          errors: {
            message: errorFromCloudinary.message,
          },
          status: HTTPStatus.BAD_GATEWAY,
        };
        sinon
          .stub(createPhoto, "createPhotoOnCloudinary")
          .resolves(responseFromCreatePhotoOnCloudinary);

        // Call the function and assert
        const result = await createPhoto.create(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.BAD_GATEWAY);
        expect(result.errors.message).to.equal(errorFromCloudinary.message);
        // Add more assertions based on your error handling logic
      });

      it("should handle errors during photo creation on Platform", async () => {
        // Mock the request object with required properties for createPhoto
        const request = {
          body: {
            // Add required properties for creating photo on Cloudinary
          },
        };

        // Mock the response from createPhotoOnCloudinary
        const responseFromCreatePhotoOnCloudinary = {
          success: true,
          data: {
            // Add necessary data for testing further steps
          },
        };
        sinon
          .stub(createPhoto, "createPhotoOnCloudinary")
          .resolves(responseFromCreatePhotoOnCloudinary);

        // Mock the response from createPhotoOnPlatform with an error
        const errorFromPlatform = new Error("Platform error");
        const responseFromCreatePhotoOnPlatform = {
          success: false,
          errors: {
            message: errorFromPlatform.message,
          },
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
        sinon
          .stub(createPhoto, "createPhotoOnPlatform")
          .resolves(responseFromCreatePhotoOnPlatform);

        // Call the function and assert
        const result = await createPhoto.create(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors.message).to.equal(errorFromPlatform.message);
        // Add more assertions based on your error handling logic
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("update", () => {
      it("should update photo successfully", async () => {
        // Mock the request object with required properties for updatePhotoOnCloudinary
        const request = {
          // Add required properties for updating photo on Cloudinary
        };

        // Mock the response from updatePhotoOnCloudinary
        const responseFromUpdatePhotoOnCloudinary = {
          success: true,
          data: {
            // Add necessary data for testing further steps
          },
        };
        sinon
          .stub(createPhoto, "updatePhotoOnCloudinary")
          .resolves(responseFromUpdatePhotoOnCloudinary);

        // Mock the response from updatePhotoOnPlatform
        const responseFromUpdatePhotoOnPlatform = {
          success: true,
          data: {
            // Add necessary data for testing final response
          },
        };
        sinon
          .stub(createPhoto, "updatePhotoOnPlatform")
          .resolves(responseFromUpdatePhotoOnPlatform);

        // Call the function and assert
        const result = await createPhoto.update(request);

        expect(result.success).to.be.true;
        expect(result.data).to.exist;
        // Add more assertions based on the expected results of the update function
      });

      it("should handle errors during photo update on Cloudinary", async () => {
        // Mock the request object with required properties for updatePhotoOnCloudinary
        const request = {
          // Add required properties for updating photo on Cloudinary
        };

        // Mock the response from updatePhotoOnCloudinary with an error
        const errorFromCloudinary = new Error("Cloudinary error");
        const responseFromUpdatePhotoOnCloudinary = {
          success: false,
          errors: {
            message: errorFromCloudinary.message,
          },
          status: HTTPStatus.BAD_GATEWAY,
        };
        sinon
          .stub(createPhoto, "updatePhotoOnCloudinary")
          .resolves(responseFromUpdatePhotoOnCloudinary);

        // Call the function and assert
        const result = await createPhoto.update(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.BAD_GATEWAY);
        expect(result.errors.message).to.equal(errorFromCloudinary.message);
        // Add more assertions based on your error handling logic
      });

      it("should handle errors during photo update on Platform", async () => {
        // Mock the request object with required properties for updatePhotoOnCloudinary
        const request = {
          // Add required properties for updating photo on Cloudinary
        };

        // Mock the response from updatePhotoOnCloudinary
        const responseFromUpdatePhotoOnCloudinary = {
          success: true,
          data: {
            // Add necessary data for testing further steps
          },
        };
        sinon
          .stub(createPhoto, "updatePhotoOnCloudinary")
          .resolves(responseFromUpdatePhotoOnCloudinary);

        // Mock the response from updatePhotoOnPlatform with an error
        const errorFromPlatform = new Error("Platform error");
        const responseFromUpdatePhotoOnPlatform = {
          success: false,
          errors: {
            message: errorFromPlatform.message,
          },
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
        sinon
          .stub(createPhoto, "updatePhotoOnPlatform")
          .resolves(responseFromUpdatePhotoOnPlatform);

        // Call the function and assert
        const result = await createPhoto.update(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors.message).to.equal(errorFromPlatform.message);
        // Add more assertions based on your error handling logic
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("extractPhotoDetails", () => {
      it("should extract photo details successfully when only one photo is found", async () => {
        // Mock the request object with required properties for createPhoto.list
        const request = {
          // Add required properties for listing photos
        };

        // Mock the response from createPhoto.list when one photo is found
        const responseFromListPhotos = {
          success: true,
          data: [
            {
              // Add necessary data for one photo
            },
          ],
        };
        sinon.stub(createPhoto, "list").resolves(responseFromListPhotos);

        // Call the function and assert
        const result = await createPhoto.extractPhotoDetails(request);

        expect(result.success).to.be.true;
        expect(result.data).to.exist;
        // Add more assertions based on the expected results when one photo is found
      });

      it("should handle the case when more than one photo is found", async () => {
        // Mock the request object with required properties for createPhoto.list
        const request = {
          // Add required properties for listing photos
        };

        // Mock the response from createPhoto.list when more than one photo is found
        const responseFromListPhotos = {
          success: true,
          data: [
            {
              // Add necessary data for photo 1
            },
            {
              // Add necessary data for photo 2
            },
            // Add more photos if necessary
          ],
        };
        sinon.stub(createPhoto, "list").resolves(responseFromListPhotos);

        // Call the function and assert
        const result = await createPhoto.extractPhotoDetails(request);

        expect(result.success).to.be.false;
        expect(result.errors.message).to.equal(
          "realized more than one photo from the system"
        );
        // Add more assertions based on the expected error handling logic
      });

      it("should handle errors when listing photos", async () => {
        // Mock the request object with required properties for createPhoto.list
        const request = {
          // Add required properties for listing photos
        };

        // Mock an error when listing photos
        const errorFromListPhotos = new Error("List photos error");
        const responseFromListPhotos = {
          success: false,
          errors: {
            message: errorFromListPhotos.message,
          },
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
        sinon.stub(createPhoto, "list").resolves(responseFromListPhotos);

        // Call the function and assert
        const result = await createPhoto.extractPhotoDetails(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors.message).to.equal(errorFromListPhotos.message);
        // Add more assertions based on your error handling logic
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("delete", () => {
      it("should delete photo successfully when one photo is found", async () => {
        // Mock the request object with required properties for createPhoto.extractPhotoDetails
        const request = {
          // Add required properties for extracting photo details
          query: {
            // Add necessary query parameters, such as 'id'
          },
        };

        // Mock the response from createPhoto.extractPhotoDetails when one photo is found
        const responseFromExtractPhotoDetails = {
          success: true,
          data: {
            // Add necessary data for the found photo
          },
        };
        sinon
          .stub(createPhoto, "extractPhotoDetails")
          .resolves(responseFromExtractPhotoDetails);

        // Mock the response from createPhoto.deletePhotoOnCloudinary when photo deletion on Cloudinary is successful
        const responseFromDeletePhotoOnCloudinary = {
          success: true,
          // Add necessary data for the successful deletion response
        };
        sinon
          .stub(createPhoto, "deletePhotoOnCloudinary")
          .resolves(responseFromDeletePhotoOnCloudinary);

        // Mock the response from createPhoto.deletePhotoOnPlatform when photo deletion on the platform is successful
        const responseFromDeletePhotoOnPlatform = {
          success: true,
          // Add necessary data for the successful platform deletion response
        };
        sinon
          .stub(createPhoto, "deletePhotoOnPlatform")
          .resolves(responseFromDeletePhotoOnPlatform);

        // Call the function and assert
        const result = await createPhoto.delete(request);

        expect(result.success).to.be.true;
        // Add more assertions based on the expected results when one photo is found and successfully deleted
      });

      it("should handle the case when no photo is found", async () => {
        // Mock the request object with required properties for createPhoto.extractPhotoDetails
        const request = {
          // Add required properties for extracting photo details
          query: {
            // Add necessary query parameters, such as 'id'
          },
        };

        // Mock the response from createPhoto.extractPhotoDetails when no photo is found
        const responseFromExtractPhotoDetails = {
          success: false,
          // Add necessary error data when no photo is found
        };
        sinon
          .stub(createPhoto, "extractPhotoDetails")
          .resolves(responseFromExtractPhotoDetails);

        // Call the function and assert
        const result = await createPhoto.delete(request);

        expect(result.success).to.be.false;
        // Add more assertions based on the expected error handling logic when no photo is found
      });

      it("should handle errors when extracting photo details", async () => {
        // Mock the request object with required properties for createPhoto.extractPhotoDetails
        const request = {
          // Add required properties for extracting photo details
          query: {
            // Add necessary query parameters, such as 'id'
          },
        };

        // Mock an error when extracting photo details
        const errorFromExtractPhotoDetails = new Error(
          "Extract photo details error"
        );
        const responseFromExtractPhotoDetails = {
          success: false,
          errors: {
            message: errorFromExtractPhotoDetails.message,
          },
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
        sinon
          .stub(createPhoto, "extractPhotoDetails")
          .resolves(responseFromExtractPhotoDetails);

        // Call the function and assert
        const result = await createPhoto.delete(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors.message).to.equal(
          errorFromExtractPhotoDetails.message
        );
        // Add more assertions based on your error handling logic
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("list", () => {
      it("should list photos successfully", async () => {
        // Mock the request object with required properties for createPhoto.list
        const request = {
          // Add required properties for listing photos
          query: {
            tenant: "your_tenant_name", // Replace with the actual tenant name
            limit: 10, // Set the desired limit value
            skip: 0, // Set the desired skip value
            // Add other query parameters if needed
          },
        };

        // Mock the filter for generateFilter.photos(request)
        const filter = {
          // Add necessary filter criteria based on your request object
        };
        sinon.stub(generateFilter, "photos").returns(filter);

        // Mock the response from getModelByTenant.list
        const photosData = {
          // Add mock data for the list of photos
        };
        sinon.stub(PhotoSchema, "list").resolves(photosData);

        // Call the function and assert
        const result = await createPhoto.list(request);

        expect(result.success).to.be.true;
        // Add more assertions based on the expected results of successful listing
      });

      it("should handle errors when listing photos", async () => {
        // Mock the request object with required properties for createPhoto.list
        const request = {
          // Add required properties for listing photos
          query: {
            tenant: "your_tenant_name", // Replace with the actual tenant name
            limit: 10, // Set the desired limit value
            skip: 0, // Set the desired skip value
            // Add other query parameters if needed
          },
        };

        // Mock the filter for generateFilter.photos(request)
        const filter = {
          // Add necessary filter criteria based on your request object
        };
        sinon.stub(generateFilter, "photos").returns(filter);

        // Mock an error when listing photos
        const errorFromListPhotos = new Error("List photos error");
        sinon.stub(PhotoSchema, "list").rejects(errorFromListPhotos);

        // Call the function and assert
        const result = await createPhoto.list(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors.message).to.equal(errorFromListPhotos.message);
        // Add more assertions based on your error handling logic
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("createPhotoOnCloudinary", () => {
      it("should upload image to Cloudinary successfully", async () => {
        // Mock the request object with required properties for createPhoto.createPhotoOnCloudinary
        const request = {
          // Add required properties for uploading image to Cloudinary
          body: {
            path: "path/to/your/image.jpg", // Replace with the actual image path
            resource_type: "image", // Set the resource type (e.g., "image" or "video")
            device_name: "your_device_name", // Replace with the actual device name
            // Add other body parameters if needed
          },
        };

        // Mock the Cloudinary response for uploader.upload
        const cloudinaryUploadResponse = {
          // Add the mock response from Cloudinary uploader.upload
          public_id: "your_cloudinary_public_id", // Replace with the actual public ID from Cloudinary
          secure_url: "your_cloudinary_image_url", // Replace with the actual secure URL from Cloudinary
          version: "v123456789", // Replace with the actual version from Cloudinary
          // Add other response properties as needed
        };
        sinon
          .stub(cloudinary.uploader, "upload")
          .callsFake((path, options, callback) => {
            // Call the provided callback with the mocked response
            callback(null, cloudinaryUploadResponse);
          });

        // Call the function and assert
        const result = await createPhoto.createPhotoOnCloudinary(request);

        expect(result.success).to.be.true;
        expect(result.status).to.equal(HTTPStatus.OK);
        // Add more assertions based on the expected results of successful upload
      });

      it("should handle errors when uploading image to Cloudinary", async () => {
        // Mock the request object with required properties for createPhoto.createPhotoOnCloudinary
        const request = {
          // Add required properties for uploading image to Cloudinary
          body: {
            path: "path/to/your/image.jpg", // Replace with the actual image path
            resource_type: "image", // Set the resource type (e.g., "image" or "video")
            device_name: "your_device_name", // Replace with the actual device name
            // Add other body parameters if needed
          },
        };

        // Mock an error when uploading image to Cloudinary
        const errorFromCloudinary = new Error("Cloudinary upload error");
        sinon
          .stub(cloudinary.uploader, "upload")
          .callsFake((path, options, callback) => {
            // Call the provided callback with the error
            callback(errorFromCloudinary);
          });

        // Call the function and assert
        const result = await createPhoto.createPhotoOnCloudinary(request);

        expect(result.success).to.be.false;
        expect(result.status).to.equal(HTTPStatus.BAD_GATEWAY);
        expect(result.errors.message).to.equal(errorFromCloudinary.message);
        // Add more assertions based on your error handling logic
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("updatePhotoOnCloudinary", () => {
      it("should return success response if update on Cloudinary is successful", async () => {
        // Mock the request object if needed for updatePhotoOnCloudinary
        const request = {
          // Add any required properties for the function
          // ...
        };

        // Mock the response from the Cloudinary update call
        const responseFromUpdateOnCloudinary = {
          success: true,
          data: {
            // Add any data that you expect to receive from the Cloudinary update
            // ...
          },
          status: HTTPStatus.OK, // Replace with the appropriate HTTP status code
        };

        // Stub the method that makes the actual Cloudinary update call
        sinon
          .stub(createPhoto, "updatePhotoOnCloudinary")
          .resolves(responseFromUpdateOnCloudinary);

        // Call the function and assert
        const result = await createPhoto.updatePhotoOnCloudinary(request);

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully updated photo on cloudinary"
        );
        expect(result.data).to.deep.equal(responseFromUpdateOnCloudinary.data);
        expect(result.status).to.equal(responseFromUpdateOnCloudinary.status);
        // Add more assertions based on the expected results
      });

      it("should return error response if update on Cloudinary is not successful", async () => {
        // Mock the request object if needed for updatePhotoOnCloudinary
        const request = {
          // Add any required properties for the function
          // ...
        };

        // Mock the response from the Cloudinary update call indicating failure
        const responseFromUpdateOnCloudinary = {
          success: false,
          message: "Error message from Cloudinary",
          // Add any other properties based on your actual implementation
        };

        // Stub the method that makes the actual Cloudinary update call
        sinon
          .stub(createPhoto, "updatePhotoOnCloudinary")
          .resolves(responseFromUpdateOnCloudinary);

        // Call the function and assert
        const result = await createPhoto.updatePhotoOnCloudinary(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Error message from Cloudinary");
        // Add more assertions based on the expected results for failure case
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("deletePhotoOnCloudinary", () => {
      it("should return success response if images are deleted successfully from Cloudinary", async () => {
        // Mock the request object if needed for deletePhotoOnCloudinary
        const request = {
          // Add any required properties for the function
          // ...
        };

        // Mock the response from the createPhoto.extractImageIds call
        const responseFromExtractImageIds = {
          success: true,
          data: ["image_id1", "image_id2"], // Replace with the image IDs you expect to extract
          // Add any other properties based on your actual implementation
        };

        // Stub the method that makes the actual createPhoto.extractImageIds call
        sinon
          .stub(createPhoto, "extractImageIds")
          .resolves(responseFromExtractImageIds);

        // Stub the Cloudinary API call to delete resources
        const responseFromCloudinary = {
          deleted: {
            image_id1: "deleted",
            image_id2: "deleted",
            // Add more image IDs with "deleted" or "not_found" status based on your actual implementation
          },
        };
        sinon
          .stub(cloudinary.api, "delete_resources")
          .resolves(responseFromCloudinary);

        // Call the function and assert
        const result = await createPhoto.deletePhotoOnCloudinary(request);

        expect(result.success).to.be.true;
        expect(result.message).to.equal("image(s) deleted successfully");
        expect(result.data).to.deep.equal(responseFromExtractImageIds.data);
        expect(result.status).to.equal(HTTPStatus.OK);
        // Add more assertions based on the expected results for successful deletions
      });

      it("should return error response if images are not deleted from Cloudinary", async () => {
        // Mock the request object if needed for deletePhotoOnCloudinary
        const request = {
          // Add any required properties for the function
          // ...
        };

        // Mock the response from the createPhoto.extractImageIds call
        const responseFromExtractImageIds = {
          success: true,
          data: ["image_id1", "image_id2"], // Replace with the image IDs you expect to extract
          // Add any other properties based on your actual implementation
        };

        // Stub the method that makes the actual createPhoto.extractImageIds call
        sinon
          .stub(createPhoto, "extractImageIds")
          .resolves(responseFromExtractImageIds);

        // Stub the Cloudinary API call to delete resources indicating failure
        const responseFromCloudinary = {
          deleted: {
            image_id1: "not_found",
            image_id2: "not_found",
            // Add more image IDs with "deleted" or "not_found" status based on your actual implementation
          },
        };
        sinon
          .stub(cloudinary.api, "delete_resources")
          .resolves(responseFromCloudinary);

        // Call the function and assert
        const result = await createPhoto.deletePhotoOnCloudinary(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "unable to delete any of the provided or associated image URLs"
        );
        expect(result.errors).to.deep.equal(responseFromCloudinary.deleted);
        expect(result.status).to.equal(HTTPStatus.NOT_FOUND);
        // Add more assertions based on the expected results for failure case
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("extractImageIds", () => {
      it("should extract image IDs and return success response", () => {
        // Mock the request object if needed for extractImageIds
        const request = {
          body: {
            image_urls: [
              "https://example.com/image1.jpg",
              "https://example.com/image2.jpg",
            ], // Replace with the image URLs you expect to process
          },
          query: {
            device_name: "device1", // Replace with the device name or other identifiers you expect to use
            // Add any other properties based on your actual implementation
          },
        };

        // Mock the response from the createPhoto.getCloudinaryPaths call
        const responseFromGetCloudinaryPaths = {
          success: true,
          data: {
            lastSegment: "image1",
            thirdLastSegment: "folder1",
            // Add any other properties based on your actual implementation
          },
        };

        // Stub the method that makes the actual createPhoto.getCloudinaryPaths call
        sinon
          .stub(createPhoto, "getCloudinaryPaths")
          .returns(responseFromGetCloudinaryPaths);

        // Call the function and assert
        const result = createPhoto.extractImageIds(request);

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal([
          "folder1/device1/image1" /* Add more image IDs based on your actual implementation */,
        ]);
        expect(result.message).to.equal("successfully extracted the Image Ids");
        expect(result.status).to.equal(HTTPStatus.OK);
        // Add more assertions based on the expected results for successful extraction
      });

      it("should return error response if unable to extract image IDs", () => {
        // Mock the request object if needed for extractImageIds
        const request = {
          body: {
            image_urls: [
              "https://example.com/image1.jpg",
              "https://example.com/image2.jpg",
            ], // Replace with the image URLs you expect to process
          },
          query: {
            device_name: "device1", // Replace with the device name or other identifiers you expect to use
            // Add any other properties based on your actual implementation
          },
        };

        // Mock the response from the createPhoto.getCloudinaryPaths call indicating failure
        const responseFromGetCloudinaryPaths = {
          success: false,
          // Add any other properties based on your actual implementation
        };

        // Stub the method that makes the actual createPhoto.getCloudinaryPaths call
        sinon
          .stub(createPhoto, "getCloudinaryPaths")
          .returns(responseFromGetCloudinaryPaths);

        // Call the function and assert
        const result = createPhoto.extractImageIds(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors).to.exist; // Make assertions for the error response based on your actual implementation
        // Add more assertions based on the expected results for failure case
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("getCloudinaryPaths", () => {
      it("should remove file extension and return success response", () => {
        // Mock the request object if needed for getCloudinaryPaths
        const request = {
          imageURL: "https://example.com/folder1/device1/image1.jpg", // Replace with the image URL you expect to process
        };

        // Call the function and assert
        const result = createPhoto.getCloudinaryPaths(request);

        expect(result.success).to.be.true;
        expect(result.data.lastSegment).to.equal("image1");
        expect(result.data.thirdLastSegment).to.equal("device1");
        expect(result.message).to.equal(
          "successfully removed the file extension"
        );
        expect(result.status).to.equal(HTTPStatus.OK);
        // Add more assertions based on the expected results for successful file extension removal
      });

      it("should return error response if unable to remove file extension", () => {
        // Mock the request object if needed for getCloudinaryPaths
        const request = {
          imageURL: "https://example.com/image2.jpg", // Replace with the image URL you expect to process
        };

        // Call the function and assert
        const result = createPhoto.getCloudinaryPaths(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors).to.exist; // Make assertions for the error response based on your actual implementation
        // Add more assertions based on the expected results for failure case
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("deletePhotoOnPlatform", () => {
      it("should delete photo on platform and return success response", async () => {
        // Mock the request object if needed for deletePhotoOnPlatform
        const request = {
          query: {
            tenant: "example_tenant", // Replace with the tenant you want to test
          },
          body: {
            // Replace with the relevant data for deleting the photo on the platform
            // For example, you may need to provide a filter or specific photo data
          },
        };

        // Call the function and assert
        const result = await createPhoto.deletePhotoOnPlatform(request);

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "Success message from deletePhotoOnPlatform"
        );
        expect(result.status).to.equal(HTTPStatus.OK);
        expect(result.data).to.exist; // Make assertions based on the expected response data
        // Add more assertions based on the expected results for successful photo deletion
      });

      it("should return error response if photo deletion on platform fails", async () => {
        // Mock the request object if needed for deletePhotoOnPlatform
        const request = {
          query: {
            tenant: "example_tenant", // Replace with the tenant you want to test
          },
          body: {
            // Replace with the relevant data for deleting the photo on the platform
            // For example, you may need to provide a filter or specific photo data
          },
        };

        // Call the function and assert
        const result = await createPhoto.deletePhotoOnPlatform(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors).to.exist; // Make assertions for the error response based on your actual implementation
        // Add more assertions based on the expected results for failure case
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("updatePhotoOnPlatform", () => {
      it("should update photo on platform and return success response", async () => {
        // Mock the request object if needed for updatePhotoOnPlatform
        const request = {
          query: {
            tenant: "example_tenant", // Replace with the tenant you want to test
          },
          body: {
            // Replace with the relevant data for updating the photo on the platform
            // For example, you may need to provide a filter, update data, or specific photo details
          },
        };

        // Call the function and assert
        const result = await createPhoto.updatePhotoOnPlatform(request);

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "Success message from updatePhotoOnPlatform"
        );
        expect(result.status).to.equal(HTTPStatus.OK);
        expect(result.data).to.exist; // Make assertions based on the expected response data
        // Add more assertions based on the expected results for successful photo update
      });

      it("should return error response if photo update on platform fails", async () => {
        // Mock the request object if needed for updatePhotoOnPlatform
        const request = {
          query: {
            tenant: "example_tenant", // Replace with the tenant you want to test
          },
          body: {
            // Replace with the relevant data for updating the photo on the platform
            // For example, you may need to provide a filter, update data, or specific photo details
          },
        };

        // Call the function and assert
        const result = await createPhoto.updatePhotoOnPlatform(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors).to.exist; // Make assertions for the error response based on your actual implementation
        // Add more assertions based on the expected results for failure case
      });

      // Add more test cases for different scenarios if necessary
    });
    describe("createPhotoOnPlatform", () => {
      it("should create photo on platform and return success response", async () => {
        // Mock the request object if needed for createPhotoOnPlatform
        const request = {
          query: {
            tenant: "example_tenant", // Replace with the tenant you want to test
          },
          body: {
            // Replace with the relevant data for creating the photo on the platform
            // For example, you may need to provide image_url, device_name, device_id, etc.
          },
        };

        // Mock the response from extractImageIds
        const extractImageIdsResponse = {
          success: true,
          data: ["example_photo_id"],
        };

        // Mock the response from register
        const registerResponse = {
          success: true,
          message: "Success message from register",
          data: {
            /* Replace with the expected response data from register */
          },
        };

        // Stub the extractImageIds function to return the mock response
        const extractImageIdsStub = sinon.stub(createPhoto, "extractImageIds");
        extractImageIdsStub.resolves(extractImageIdsResponse);

        // Stub the getModelByTenant function to return the mock response from register
        const getModelByTenantStub = sinon.stub(
          createPhoto,
          "getModelByTenant"
        );
        getModelByTenantStub.resolves({
          register: sinon.stub().resolves(registerResponse),
        });

        // Call the function and assert
        const result = await createPhoto.createPhotoOnPlatform(request);

        expect(result.success).to.be.true;
        expect(result.message).to.equal("Success message from register");
        expect(result.status).to.equal(HTTPStatus.OK);
        expect(result.data).to.exist; // Make assertions based on the expected response data
        // Add more assertions based on the expected results for successful photo creation

        // Restore the stubs to their original functions
        extractImageIdsStub.restore();
        getModelByTenantStub.restore();
      });

      it("should return error response if image ID extraction fails", async () => {
        // Mock the request object if needed for createPhotoOnPlatform
        const request = {
          query: {
            tenant: "example_tenant", // Replace with the tenant you want to test
          },
          body: {
            // Replace with the relevant data for creating the photo on the platform
            // For example, you may need to provide image_url, device_name, device_id, etc.
          },
        };

        // Mock the response from extractImageIds with failure
        const extractImageIdsResponse = {
          success: false,
          message: "Error message from extractImageIds",
        };

        // Stub the extractImageIds function to return the mock response
        const extractImageIdsStub = sinon.stub(createPhoto, "extractImageIds");
        extractImageIdsStub.resolves(extractImageIdsResponse);

        // Call the function and assert
        const result = await createPhoto.createPhotoOnPlatform(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Error message from extractImageIds");
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors).to.exist; // Make assertions for the error response based on your actual implementation
        // Add more assertions based on the expected results for failure case

        // Restore the stub to its original function
        extractImageIdsStub.restore();
      });

      it("should return error response if photo registration on platform fails", async () => {
        // Mock the request object if needed for createPhotoOnPlatform
        const request = {
          query: {
            tenant: "example_tenant", // Replace with the tenant you want to test
          },
          body: {
            // Replace with the relevant data for creating the photo on the platform
            // For example, you may need to provide image_url, device_name, device_id, etc.
          },
        };

        // Mock the response from extractImageIds
        const extractImageIdsResponse = {
          success: true,
          data: ["example_photo_id"],
        };

        // Mock the response from register with failure
        const registerResponse = {
          success: false,
          message: "Error message from register",
        };

        // Stub the extractImageIds function to return the mock response
        const extractImageIdsStub = sinon.stub(createPhoto, "extractImageIds");
        extractImageIdsStub.resolves(extractImageIdsResponse);

        // Stub the getModelByTenant function to return the mock response from register
        const getModelByTenantStub = sinon.stub(
          createPhoto,
          "getModelByTenant"
        );
        getModelByTenantStub.resolves({
          register: sinon.stub().resolves(registerResponse),
        });

        // Call the function and assert
        const result = await createPhoto.createPhotoOnPlatform(request);

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Error message from register");
        expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors).to.exist; // Make assertions for the error response based on your actual implementation
        // Add more assertions based on the expected results for failure case

        // Restore the stubs to their original functions
        extractImageIdsStub.restore();
        getModelByTenantStub.restore();
      });

      // Add more test cases for different scenarios if necessary
    });
  });
});
