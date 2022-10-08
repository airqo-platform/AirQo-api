resource "google_pubsub_topic" "user" {
  name    = "user"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.user projects/airqo-250220/topics/user
