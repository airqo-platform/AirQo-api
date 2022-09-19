resource "google_service_account" "github_actions_depolyer" {
  account_id   = "github-actions-depolyer"
  description  = "This service account deploys website changes from the github actions to app engine"
  display_name = "github actions depolyer"
  project      = "airqo-frontend"
}
# terraform import google_service_account.github_actions_depolyer projects/airqo-frontend/serviceAccounts/github-actions-depolyer@airqo-frontend.iam.gserviceaccount.com
