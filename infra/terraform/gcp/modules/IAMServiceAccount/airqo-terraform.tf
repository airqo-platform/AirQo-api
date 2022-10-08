resource "google_service_account" "airqo_terraform" {
  account_id   = "airqo-terraform"
  display_name = "airqo-terraform"
  project      = "${var.project-id}"
}
# terraform import google_service_account.airqo_terraform projects/airqo-250220/serviceAccounts/airqo-terraform@airqo-250220.iam.gserviceaccount.com
