resource "google_secret_manager_secret" "prod_env_datawarehouse" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-datawarehouse"
}
# terraform import google_secret_manager_secret.prod_env_datawarehouse projects/702081712633/secrets/prod-env-datawarehouse
