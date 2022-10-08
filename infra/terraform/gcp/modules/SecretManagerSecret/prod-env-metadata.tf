resource "google_secret_manager_secret" "prod_env_metadata" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-metadata"
}
# terraform import google_secret_manager_secret.prod_env_metadata projects/702081712633/secrets/prod-env-metadata
