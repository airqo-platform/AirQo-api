resource "google_secret_manager_secret" "prod_env_website" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-website"
}
# terraform import google_secret_manager_secret.prod_env_website projects/702081712633/secrets/prod-env-website
