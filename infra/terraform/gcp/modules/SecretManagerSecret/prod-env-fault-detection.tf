resource "google_secret_manager_secret" "prod_env_fault_detection" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-fault-detection"
}
# terraform import google_secret_manager_secret.prod_env_fault_detection projects/${var.project-number}/secrets/prod-env-fault-detection
