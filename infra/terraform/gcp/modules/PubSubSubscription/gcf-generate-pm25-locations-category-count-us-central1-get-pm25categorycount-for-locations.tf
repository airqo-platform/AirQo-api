resource "google_pubsub_subscription" "gcf_generate_pm25_locations_category_count_us_central1_get_pm25categorycount_for_locations" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-generate_pm25_locations_category_count-us-central1-get_pm25categorycount_for_locations"
  project                    = "${var.project-id}"

  push_config {
    push_endpoint = "https://91655fba3d0ac44d3ef215be4c65b46a-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/get_pm25categorycount_for_locations?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/get_pm25categorycount_for_locations"
}
# terraform import google_pubsub_subscription.gcf_generate_pm25_locations_category_count_us_central1_get_pm25categorycount_for_locations projects/airqo-250220/subscriptions/gcf-generate_pm25_locations_category_count-us-central1-get_pm25categorycount_for_locations
