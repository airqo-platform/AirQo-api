resource "google_service_account" "github_pr_preview_deployer" {
  account_id   = "github-pr-preview-deployer"
  description  = "This service account is used to deploy PR changes from GitHub to cloud run. Also avails Secret Manager secrets for use in k8s injection GitHub actions"
  display_name = "github-pr-preview-deployer"
  project      = "airqo-250220"
}
# terraform import google_service_account.github_pr_preview_deployer projects/airqo-250220/serviceAccounts/github-pr-preview-deployer@airqo-250220.iam.gserviceaccount.com
