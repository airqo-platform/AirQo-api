resource "google_secret_manager_secret" "sta_backup_web" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-backup-web"
}
# terraform import google_secret_manager_secret.sta_backup_web projects/702081712633/secrets/sta-backup-web
