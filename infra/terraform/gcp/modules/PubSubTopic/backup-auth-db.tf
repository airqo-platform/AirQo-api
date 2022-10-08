resource "google_pubsub_topic" "backup_auth_db" {
  name    = "backup-auth-db"
  project = var.project-id
}
# terraform import google_pubsub_topic.backup_auth_db projects/${var.project-id}/topics/backup-auth-db
