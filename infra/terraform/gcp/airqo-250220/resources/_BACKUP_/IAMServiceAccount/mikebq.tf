resource "google_service_account" "mikebq" {
  account_id   = "mikebq"
  display_name = "MikeBQ"
  project      = "airqo-250220"
}
# terraform import google_service_account.mikebq projects/airqo-250220/serviceAccounts/mikebq@airqo-250220.iam.gserviceaccount.com
