resource "google_service_account" "martin_big_query" {
  account_id   = "martin-big-query"
  description  = "service account for accessing BQ data"
  display_name = "martin-big-query"
  project      = var.project-id
}
# terraform import google_service_account.martin_big_query projects/${var.project-id}/serviceAccounts/martin-big-query@airqo-250220.iam.gserviceaccount.com
