resource "google_service_account" "data_mgt" {
  account_id   = "data-mgt"
  description  = "all actions related to the data management service"
  display_name = "data-mgt"
  project      = "airqo-250220"
}
# terraform import google_service_account.data_mgt projects/airqo-250220/serviceAccounts/data-mgt@airqo-250220.iam.gserviceaccount.com
