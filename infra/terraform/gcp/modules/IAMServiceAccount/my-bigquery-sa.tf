resource "google_service_account" "my_bigquery_sa" {
  account_id   = "my-bigquery-sa"
  display_name = "my bigquery codelab service account"
  project      = var.project-id
}
# terraform import google_service_account.my_bigquery_sa projects/${var.project-id}/serviceAccounts/my-bigquery-sa@${var.project-id}.iam.gserviceaccount.com
