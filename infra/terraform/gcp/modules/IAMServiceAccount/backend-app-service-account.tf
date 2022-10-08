resource "google_service_account" "backend_app_service_account" {
  account_id   = "backend-app-service-account"
  description  = "service account for connecting back-end applications to cloud resources such as big query using code"
  display_name = "backend-app-service-account"
  project      = var.project-id
}
# terraform import google_service_account.backend_app_service_account projects/${var.project-id}/serviceAccounts/backend-app-service-account@${var.project-id}.iam.gserviceaccount.com
