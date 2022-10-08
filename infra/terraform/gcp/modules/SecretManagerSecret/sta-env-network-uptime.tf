resource "google_secret_manager_secret" "sta_env_network_uptime" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-network-uptime"
}
# terraform import google_secret_manager_secret.sta_env_network_uptime projects/${var.project-number}/secrets/sta-env-network-uptime
