resource "google_secret_manager_secret" "sta_env_network_uptime" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-network-uptime"
}
# terraform import google_secret_manager_secret.sta_env_network_uptime projects/702081712633/secrets/sta-env-network-uptime
