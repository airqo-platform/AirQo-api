resource "google_service_account" "bq_storage_admin" {
  account_id   = "bq-storage-admin"
  display_name = "bq-storage-admin"
  project      = "airqo-250220"
}
# terraform import google_service_account.bq_storage_admin projects/airqo-250220/serviceAccounts/bq-storage-admin@airqo-250220.iam.gserviceaccount.com
