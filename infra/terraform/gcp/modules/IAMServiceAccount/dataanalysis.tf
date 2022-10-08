resource "google_service_account" "dataanalysis" {
  account_id   = "dataanalysis"
  display_name = "dataAnalysis"
  project      = var.project-id
}
# terraform import google_service_account.dataanalysis projects/${var.project-id}/serviceAccounts/dataanalysis@airqo-250220.iam.gserviceaccount.com
