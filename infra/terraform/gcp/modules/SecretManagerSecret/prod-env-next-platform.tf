resource "google_secret_manager_secret" "prod_env_next_platform" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-next-platform"
}
# terraform import google_secret_manager_secret.prod_env_next_platform projects/${var.project-number}/secrets/prod-env-next-platform
