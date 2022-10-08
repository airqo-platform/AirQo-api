resource "google_pubsub_topic" "firebase_schedule_scheduledfirestoreexport_us_central1" {
  name    = "firebase-schedule-scheduledFirestoreExport-us-central1"
  project = var.project-id
}
# terraform import google_pubsub_topic.firebase_schedule_scheduledfirestoreexport_us_central1 projects/${var.project-id}/topics/firebase-schedule-scheduledFirestoreExport-us-central1
