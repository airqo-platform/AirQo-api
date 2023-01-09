resource "google_secret_manager_secret" "prod_key_analytics_report_job_service_account" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-key-analytics-report-job-service-account"
}
# terraform import google_secret_manager_secret.prod_key_analytics_report_job_service_account projects/${var.project-number}/secrets/prod-key-analytics-report-job-service-account
