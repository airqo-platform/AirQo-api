resource "google_secret_manager_secret" "prod_env_netmanager" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-netmanager"
}
# terraform import google_secret_manager_secret.prod_env_netmanager projects/702081712633/secrets/prod-env-netmanager
