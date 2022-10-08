resource "google_secret_manager_secret" "prod_env_gp_model" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-gp-model"
}
# terraform import google_secret_manager_secret.prod_env_gp_model projects/${var.project-number}/secrets/prod-env-gp-model
