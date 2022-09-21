resource "google_service_account" "bala_701" {
  account_id   = "bala-701"
  description  = "account-cred"
  display_name = "bala"
  project      = "airqo-250220"
}
# terraform import google_service_account.bala_701 projects/airqo-250220/serviceAccounts/bala-701@airqo-250220.iam.gserviceaccount.com
