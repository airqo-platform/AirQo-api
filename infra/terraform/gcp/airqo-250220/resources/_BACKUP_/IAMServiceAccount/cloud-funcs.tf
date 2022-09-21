resource "google_service_account" "cloud_funcs" {
  account_id = "cloud-funcs"
  project    = "airqo-250220"
}
# terraform import google_service_account.cloud_funcs projects/airqo-250220/serviceAccounts/cloud-funcs@airqo-250220.iam.gserviceaccount.com
