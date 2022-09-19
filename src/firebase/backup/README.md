# Firestore to GCP backup.
This implements a cloud function and a cloud scheduler job to backup data from Firebase firestore to Google Cloud platform(GCP).
For the complete firebase documentation, refer to [this](https://firebase.google.com/docs/firestore/solutions/schedule-export).

## **Prerequisites**
- Have node and Npm insalled on your machine. You can follow the installation process from [here](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).
- Have Firebase client installed. You can follow the installation process from [here](https://firebase.google.com/docs/cli).

## **Setup**
### **Add the configuration files**
- Create or add the .env file to the following directory:(`/backup/functions`). The .env file contains the variable holding the location of your GCP bucket.

### **Create a Cloud Storage bucket.**
- Export operations require a destination Cloud Storage bucket. Create a [Cloud Storage bucket](https://cloud.google.com/storage/docs/creating-buckets) in a location near your Cloud Firestore database location. You cannot use a Requester Pays bucket for export operations.
- Add the name of your bucket in the .env file, and it should have the format `gs://bucket-name`.

### **Configure access permissions**
- Cloud Identity and Access Management(IAM) permissions need to be set up.
- Firstly, make sure your GCP account is assigned a `Service account User` role.
- Next, give the Cloud Function permission to start export operations and to write to your GCS bucket. Add the following IAM permissions for your service account in your GCP project.
  - `Cloud Datastore Import Export Admin` role on the service account.
  - `Owner or Storage Admin` role on the bucket.



## **Running the function**
First install the dependencies using;
```bash
npm install
```
Then deploy the function using;
```bash
firebase deploy --only functions
```
