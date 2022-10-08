resource "google_secret_manager_secret" "sta_env_fault_detection" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-env-fault-detection"
}
# terraform import google_secret_manager_secret.sta_env_fault_detection projects/${var.project-number}/secrets/sta-env-fault-detection
