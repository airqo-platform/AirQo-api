resource "google_secret_manager_secret" "sta_env_analytics_report_job" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-analytics-report-job"
}
# terraform import google_secret_manager_secret.sta_env_analytics_report_job projects/${var.project-number}/secrets/sta-env-analytics-report-job
