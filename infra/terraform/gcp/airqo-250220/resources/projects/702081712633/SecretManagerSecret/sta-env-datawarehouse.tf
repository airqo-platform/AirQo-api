resource "google_secret_manager_secret" "sta_env_datawarehouse" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-datawarehouse"
}
# terraform import google_secret_manager_secret.sta_env_datawarehouse projects/702081712633/secrets/sta-env-datawarehouse
