resource "google_service_account" "airqo_api" {
  account_id   = "airqo-api"
  display_name = "airqo-api"
  project      = "airqo-250220"
}
# terraform import google_service_account.airqo_api projects/airqo-250220/serviceAccounts/airqo-api@airqo-250220.iam.gserviceaccount.com
