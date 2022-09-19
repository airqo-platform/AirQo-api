resource "google_secret_manager_secret" "prod_env_locate_api" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-locate-api"
}
# terraform import google_secret_manager_secret.prod_env_locate_api projects/702081712633/secrets/prod-env-locate-api
