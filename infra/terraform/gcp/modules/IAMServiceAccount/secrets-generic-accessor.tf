resource "google_service_account" "secrets_generic_accessor" {
  account_id   = "secrets-generic-accessor"
  description  = "This service account grants airqo internal contributors generic access permissions to selected staging secrets"
  display_name = "secrets-generic-accessor"
  project      = var.project-id
}
# terraform import google_service_account.secrets_generic_accessor projects/${var.project-id}/serviceAccounts/secrets-generic-accessor@airqo-250220.iam.gserviceaccount.com
