resource "google_secret_manager_secret" "sta_key_secrets_accessor" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-key-secrets-accessor"
}
# terraform import google_secret_manager_secret.sta_key_secrets_accessor projects/702081712633/secrets/sta-key-secrets-accessor
