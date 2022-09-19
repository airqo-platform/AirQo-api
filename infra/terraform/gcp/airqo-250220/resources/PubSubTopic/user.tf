resource "google_pubsub_topic" "user" {
  name    = "user"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.user projects/airqo-250220/topics/user
