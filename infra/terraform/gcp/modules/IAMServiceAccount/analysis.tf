resource "google_service_account" "analysis" {
  account_id   = "analysis"
  display_name = "analysis"
  project      = var.project-id
}
# terraform import google_service_account.analysis projects/${var.project-id}/serviceAccounts/analysis@airqo-250220.iam.gserviceaccount.com
