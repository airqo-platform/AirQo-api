resource "google_secret_manager_secret" "prod_env_fault_detection" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-fault-detection"
}
# terraform import google_secret_manager_secret.prod_env_fault_detection projects/702081712633/secrets/prod-env-fault-detection
