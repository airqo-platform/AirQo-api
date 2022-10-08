resource "google_secret_manager_secret" "sta_env_netmanager" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-env-netmanager"
}
# terraform import google_secret_manager_secret.sta_env_netmanager projects/${var.project-number}/secrets/sta-env-netmanager
