resource "google_secret_manager_secret" "prod_env_network_uptime" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-network-uptime"
}
# terraform import google_secret_manager_secret.prod_env_network_uptime projects/${var.project-number}/secrets/prod-env-network-uptime
