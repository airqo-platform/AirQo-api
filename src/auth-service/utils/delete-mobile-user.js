const { getAuth } = require("firebase-admin/auth");
const admin = require('firebase-admin');

const constants = require("@config/constants");

const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- delete-mobile-user`);

const {db} = require("@config/firebase-admin");

const deleteMobileUser = { 
    deleteMobileUserData: async (request) => { 
    try {
      const { body } = request;
      let { uid } = body; 
      let { ct } = body;
      const userRecord = await admin.auth().getUser(uid);
      
      //get creation time and compare with ct
      let creationTime = userRecord.metadata.creationTime;
      creationTime = creationTime.replace(/\D/g, "");
      if (creationTime !== ct) {
        return {
          success: false,
          message: "Invalid request",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Invalid request" },
        };
      }

      try {
        await getAuth().deleteUser(uid);
        const collectionList = [
          constants.FIREBASE_COLLECTION_KYA,
          constants.FIREBASE_COLLECTION_ANALYTICS,
          constants.FIREBASE_COLLECTION_NOTIFICATIONS,
          constants.FIREBASE_COLLECTION_FAVORITE_PLACES
        ];
        let collectionRef = db.collection(`${constants.FIREBASE_COLLECTION_USERS}`);
        let docRef = collectionRef.doc(uid);

        docRef.delete().then(async () => {
          for (var collection of collectionList) {
            await deleteCollection(db, `${collection}/${uid}/${uid}`, 100);
            collectionRef = db.collection(`${collection}`);
            docRef = collectionRef.doc(uid);
            docRef.delete();
          }
          console.log('Document successfully deleted!');
        }).catch((error) => { 
          console.error('Error deleting document:', error);
           return {
              success: false,
              message: "Error deleting Firestore documents",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: { message: error.message }
            };
        });

        

        return {
              success: true,
              message: "User account has been deleted.",
              status: httpStatus.OK,
            };
      } catch (error) {
        console.error("Error deleting user:", error);
            return {
              success: false,
              message: "Error deleting user",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: { message: error.message },
            };
      }

    } catch (error) {
        return {
              success: false,
              message: "Internal Server Error",
              errors: { message: error.message },
            };
    }
    },
   
};

async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, batchSize, resolve, reject);
  });
}

function deleteQueryBatch(db, query, batchSize, resolve, reject) {
  query.get()
    .then((snapshot) => {
      // When there are no documents left, we are done
      if (snapshot.size == 0) {
        return 0;
      }

      // Delete documents in a batch
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        return snapshot.size;
      });
    }).then((numDeleted) => {
      if (numDeleted === 0) {
        resolve();
        return;
      }

      // Recurse on the next process tick, to avoid
      // exploding the stack.
      process.nextTick(() => {
        deleteQueryBatch(db, query, batchSize, resolve, reject);
      });
    })
    .catch(reject);
}

module.exports = deleteMobileUser;