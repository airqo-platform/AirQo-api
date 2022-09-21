resource "google_pubsub_subscription" "gcf_scheduledfirestoreexport_us_central1_firebase_schedule_scheduledfirestoreexport_us_central1" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-scheduledFirestoreExport-us-central1-firebase-schedule-scheduledFirestoreExport-us-central1"
  project                    = "airqo-250220"

  push_config {
    push_endpoint = "https://a655a887f74f1f5fbacf4bfd27f1d3e3-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/firebase-schedule-scheduledFirestoreExport-us-central1?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/firebase-schedule-scheduledFirestoreExport-us-central1"
}
# terraform import google_pubsub_subscription.gcf_scheduledfirestoreexport_us_central1_firebase_schedule_scheduledfirestoreexport_us_central1 projects/airqo-250220/subscriptions/gcf-scheduledFirestoreExport-us-central1-firebase-schedule-scheduledFirestoreExport-us-central1
