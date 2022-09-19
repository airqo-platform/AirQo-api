resource "google_secret_manager_secret" "sta_env_locate" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-locate"
}
# terraform import google_secret_manager_secret.sta_env_locate projects/702081712633/secrets/sta-env-locate
