resource "google_secret_manager_secret" "prod_env_network_uptime" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-network-uptime"

  topics {
    name = "projects/airqo-250220/topics/secrets-manager"
  }
}
# terraform import google_secret_manager_secret.prod_env_network_uptime projects/702081712633/secrets/prod-env-network-uptime
