resource "google_service_account" "martin_big_query" {
  account_id   = "martin-big-query"
  description  = "service account for accessing BQ data"
  display_name = "martin-big-query"
  project      = "airqo-250220"
}
# terraform import google_service_account.martin_big_query projects/airqo-250220/serviceAccounts/martin-big-query@airqo-250220.iam.gserviceaccount.com
