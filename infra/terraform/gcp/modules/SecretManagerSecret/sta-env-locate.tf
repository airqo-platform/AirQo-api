resource "google_secret_manager_secret" "sta_env_locate" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-locate"
}
# terraform import google_secret_manager_secret.sta_env_locate projects/${var.project-number}/secrets/sta-env-locate
