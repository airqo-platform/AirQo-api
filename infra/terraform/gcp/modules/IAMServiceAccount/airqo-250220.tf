resource "google_service_account" "airqo_250220" {
  account_id   = var.project-id
  display_name = "App Engine default service account"
  project      = var.project-id
}
# terraform import google_service_account.airqo_250220 projects/${var.project-id}/serviceAccounts/airqo-250220@airqo-250220.iam.gserviceaccount.com
