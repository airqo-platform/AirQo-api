resource "google_secret_manager_secret" "prod_env_metadata" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-metadata"
}
# terraform import google_secret_manager_secret.prod_env_metadata projects/${var.project-number}/secrets/prod-env-metadata
