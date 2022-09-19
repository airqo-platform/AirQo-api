resource "google_service_account" "noah_de" {
  account_id   = "noah-de"
  description  = "big query "
  display_name = "noah-de"
  project      = "airqo-250220"
}
# terraform import google_service_account.noah_de projects/airqo-250220/serviceAccounts/noah-de@airqo-250220.iam.gserviceaccount.com
