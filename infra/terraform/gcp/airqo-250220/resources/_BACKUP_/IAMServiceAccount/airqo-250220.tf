resource "google_service_account" "airqo_250220" {
  account_id   = "airqo-250220"
  display_name = "App Engine default service account"
  project      = "airqo-250220"
}
# terraform import google_service_account.airqo_250220 projects/airqo-250220/serviceAccounts/airqo-250220@airqo-250220.iam.gserviceaccount.com
