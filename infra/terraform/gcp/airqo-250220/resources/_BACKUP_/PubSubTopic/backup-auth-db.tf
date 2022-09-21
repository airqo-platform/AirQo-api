resource "google_pubsub_topic" "backup_auth_db" {
  name    = "backup-auth-db"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.backup_auth_db projects/airqo-250220/topics/backup-auth-db
