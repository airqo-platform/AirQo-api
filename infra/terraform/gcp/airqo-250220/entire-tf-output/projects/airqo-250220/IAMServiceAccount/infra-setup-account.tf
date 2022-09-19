resource "google_service_account" "infra_setup_account" {
  account_id   = "infra-setup-account"
  description  = "used for setting up the infrastructure accordingly"
  display_name = "infra-setup-account"
  project      = "airqo-250220"
}
# terraform import google_service_account.infra_setup_account projects/airqo-250220/serviceAccounts/infra-setup-account@airqo-250220.iam.gserviceaccount.com
