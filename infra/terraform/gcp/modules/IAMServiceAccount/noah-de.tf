resource "google_service_account" "noah_de" {
  account_id   = "noah-de"
  description  = "big query "
  display_name = "noah-de"
  project      = var.project-id
}
# terraform import google_service_account.noah_de projects/${var.project-id}/serviceAccounts/noah-de@${var.project-id}.iam.gserviceaccount.com
