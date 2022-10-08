resource "google_service_account" "airqo_api" {
  account_id   = "airqo-api"
  display_name = "airqo-api"
  project      = var.project-id
}
# terraform import google_service_account.airqo_api projects/${var.project-id}/serviceAccounts/airqo-api@${var.project-id}.iam.gserviceaccount.com
