resource "google_secret_manager_secret" "prod_env_next_platform" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-next-platform"
}
# terraform import google_secret_manager_secret.prod_env_next_platform projects/702081712633/secrets/prod-env-next-platform
