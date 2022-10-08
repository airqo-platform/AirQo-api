resource "google_secret_manager_secret" "sta_env_gp_model" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-env-gp-model"
}
# terraform import google_secret_manager_secret.sta_env_gp_model projects/${var.project-number}/secrets/sta-env-gp-model
