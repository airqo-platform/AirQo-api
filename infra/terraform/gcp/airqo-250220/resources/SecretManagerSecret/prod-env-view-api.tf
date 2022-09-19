resource "google_secret_manager_secret" "prod_env_view_api" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-view-api"
}
# terraform import google_secret_manager_secret.prod_env_view_api projects/702081712633/secrets/prod-env-view-api
