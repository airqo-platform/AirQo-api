resource "google_service_account" "infra_setup_account" {
  account_id   = "infra-setup-account"
  description  = "used for setting up the infrastructure accordingly"
  display_name = "infra-setup-account"
  project      = var.project-id
}
# terraform import google_service_account.infra_setup_account projects/${var.project-id}/serviceAccounts/infra-setup-account@${var.project-id}.iam.gserviceaccount.com
