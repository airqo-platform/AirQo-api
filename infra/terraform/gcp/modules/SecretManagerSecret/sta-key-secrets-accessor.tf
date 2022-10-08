resource "google_secret_manager_secret" "sta_key_secrets_accessor" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-key-secrets-accessor"
}
# terraform import google_secret_manager_secret.sta_key_secrets_accessor projects/${var.project-number}/secrets/sta-key-secrets-accessor
