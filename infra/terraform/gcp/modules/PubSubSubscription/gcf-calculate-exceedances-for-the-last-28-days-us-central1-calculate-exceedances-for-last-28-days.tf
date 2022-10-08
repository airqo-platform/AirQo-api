resource "google_pubsub_subscription" "gcf_calculate_exceedances_for_the_last_28_days_us_central1_calculate_exceedances_for_last_28_days" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-calculate_exceedances_for_the_last_28_days-us-central1-calculate_exceedances_for_last_28_days"
  project                    = "${var.project-id}"

  push_config {
    push_endpoint = "https://53b3349b721ef1ed66dae2531c120a39-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/calculate_exceedances_for_last_28_days?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/calculate_exceedances_for_last_28_days"
}
# terraform import google_pubsub_subscription.gcf_calculate_exceedances_for_the_last_28_days_us_central1_calculate_exceedances_for_last_28_days projects/airqo-250220/subscriptions/gcf-calculate_exceedances_for_the_last_28_days-us-central1-calculate_exceedances_for_last_28_days
