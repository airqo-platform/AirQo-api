resource "google_secret_manager_secret" "prod_env_website" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-website"
}
# terraform import google_secret_manager_secret.prod_env_website projects/${var.project-number}/secrets/prod-env-website
