resource "google_service_account" "firebase_adminsdk_6fohi" {
  account_id   = "firebase-adminsdk-6fohi"
  description  = "Firebase Admin SDK Service Agent"
  display_name = "firebase-adminsdk"
  project      = var.project-id
}
# terraform import google_service_account.firebase_adminsdk_6fohi projects/${var.project-id}/serviceAccounts/firebase-adminsdk-6fohi@${var.project-id}.iam.gserviceaccount.com
