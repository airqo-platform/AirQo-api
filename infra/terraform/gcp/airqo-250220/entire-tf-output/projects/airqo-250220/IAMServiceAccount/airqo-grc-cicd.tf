resource "google_service_account" "airqo_grc_cicd" {
  account_id   = "airqo-grc-cicd"
  display_name = "airqo-grc-cicd"
  project      = "airqo-250220"
}
# terraform import google_service_account.airqo_grc_cicd projects/airqo-250220/serviceAccounts/airqo-grc-cicd@airqo-250220.iam.gserviceaccount.com
