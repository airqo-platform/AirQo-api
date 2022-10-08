resource "google_secret_manager_secret" "sta_backup_web" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-backup-web"
}
# terraform import google_secret_manager_secret.sta_backup_web projects/${var.project-number}/secrets/sta-backup-web
