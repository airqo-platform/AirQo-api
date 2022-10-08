resource "google_service_account" "airqo_terraform" {
  account_id   = "airqo-terraform"
  display_name = "airqo-terraform"
  project      = var.project-id
}
# terraform import google_service_account.airqo_terraform projects/${var.project-id}/serviceAccounts/airqo-terraform@${var.project-id}.iam.gserviceaccount.com
