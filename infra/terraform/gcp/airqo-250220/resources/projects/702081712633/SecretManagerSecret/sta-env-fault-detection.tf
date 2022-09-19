resource "google_secret_manager_secret" "sta_env_fault_detection" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-fault-detection"
}
# terraform import google_secret_manager_secret.sta_env_fault_detection projects/702081712633/secrets/sta-env-fault-detection
