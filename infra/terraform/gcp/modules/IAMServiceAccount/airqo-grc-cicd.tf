resource "google_service_account" "airqo_grc_cicd" {
  account_id   = "airqo-grc-cicd"
  display_name = "airqo-grc-cicd"
  project      = var.project-id
}
# terraform import google_service_account.airqo_grc_cicd projects/${var.project-id}/serviceAccounts/airqo-grc-cicd@${var.project-id}.iam.gserviceaccount.com
