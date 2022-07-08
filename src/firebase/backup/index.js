require('dotenv').config();

const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();

const bucket = process.env.EXPORT_BUCKET;

exports.scheduledFirestoreExport = () => {
  const databaseName = client.databasePath(
      process.env.GCLOUD_PROJECT,
      "(default)"
  );

  client
    .exportDocuments({
      name: databaseName,
      outputUriPrefix: bucket,
      collectionIds: [],
    })
    .then(responses => {
      const response = responses[0];
      console.log(`Operation Name: ${response['name']}`);
    })
    .catch(err => {
      console.error(err);
    });
};
