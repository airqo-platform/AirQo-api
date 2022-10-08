resource "google_service_account" "bala_701" {
  account_id   = "bala-701"
  description  = "account-cred"
  display_name = "bala"
  project      = var.project-id
}
# terraform import google_service_account.bala_701 projects/${var.project-id}/serviceAccounts/bala-701@${var.project-id}.iam.gserviceaccount.com
