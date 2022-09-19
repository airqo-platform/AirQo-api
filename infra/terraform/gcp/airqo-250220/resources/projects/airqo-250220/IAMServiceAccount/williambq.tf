resource "google_service_account" "williambq" {
  account_id   = "williambq"
  description  = "for accessing BQ data"
  display_name = "williambq"
  project      = "airqo-250220"
}
# terraform import google_service_account.williambq projects/airqo-250220/serviceAccounts/williambq@airqo-250220.iam.gserviceaccount.com
