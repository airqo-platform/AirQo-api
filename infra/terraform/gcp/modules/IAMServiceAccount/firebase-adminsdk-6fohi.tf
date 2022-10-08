resource "google_service_account" "firebase_adminsdk_6fohi" {
  account_id   = "firebase-adminsdk-6fohi"
  description  = "Firebase Admin SDK Service Agent"
  display_name = "firebase-adminsdk"
  project      = "${var.project-id}"
}
# terraform import google_service_account.firebase_adminsdk_6fohi projects/airqo-250220/serviceAccounts/firebase-adminsdk-6fohi@airqo-250220.iam.gserviceaccount.com
