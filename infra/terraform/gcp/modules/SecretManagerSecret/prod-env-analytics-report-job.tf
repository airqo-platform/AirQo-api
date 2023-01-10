resource "google_secret_manager_secret" "prod_env_analytics_report_job" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-analytics-report-job"
}
# terraform import google_secret_manager_secret.prod_env_analytics_report_job projects/${var.project-number}/secrets/prod-env-analytics-report-job
