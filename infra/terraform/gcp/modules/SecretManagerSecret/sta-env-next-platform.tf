resource "google_secret_manager_secret" "sta_env_next_platform" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-env-next-platform"
}
# terraform import google_secret_manager_secret.sta_env_next_platform projects/${var.project-number}/secrets/sta-env-next-platform
