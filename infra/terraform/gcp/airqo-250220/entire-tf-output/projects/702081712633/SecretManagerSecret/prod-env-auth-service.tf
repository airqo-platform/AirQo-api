resource "google_secret_manager_secret" "prod_env_auth_service" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-auth-service"
}
# terraform import google_secret_manager_secret.prod_env_auth_service projects/702081712633/secrets/prod-env-auth-service
