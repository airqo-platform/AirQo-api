resource "google_service_account" "my_bigquery_sa" {
  account_id   = "my-bigquery-sa"
  display_name = "my bigquery codelab service account"
  project      = "airqo-250220"
}
# terraform import google_service_account.my_bigquery_sa projects/airqo-250220/serviceAccounts/my-bigquery-sa@airqo-250220.iam.gserviceaccount.com
