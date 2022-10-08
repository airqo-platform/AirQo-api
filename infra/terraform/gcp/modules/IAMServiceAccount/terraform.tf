resource "google_service_account" "terraform" {
  account_id   = "terraform"
  display_name = "terraform"
  project      = var.project-id
}
# terraform import google_service_account.terraform projects/${var.project-id}/serviceAccounts/terraform@airqo-250220.iam.gserviceaccount.com
