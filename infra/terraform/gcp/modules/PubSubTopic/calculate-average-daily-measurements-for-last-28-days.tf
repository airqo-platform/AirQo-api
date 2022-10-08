resource "google_pubsub_topic" "calculate_average_daily_measurements_for_last_28_days" {
  name    = "calculate_average_daily_measurements_for_last_28_days"
  project = var.project-id
}
# terraform import google_pubsub_topic.calculate_average_daily_measurements_for_last_28_days projects/${var.project-id}/topics/calculate_average_daily_measurements_for_last_28_days
