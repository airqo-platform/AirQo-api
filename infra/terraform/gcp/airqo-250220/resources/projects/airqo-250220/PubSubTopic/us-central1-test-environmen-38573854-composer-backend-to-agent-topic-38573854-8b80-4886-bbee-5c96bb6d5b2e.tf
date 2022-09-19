resource "google_pubsub_topic" "us_central1_test_environmen_38573854_composer_backend_to_agent_topic_38573854_8b80_4886_bbee_5c96bb6d5b2e" {
  labels = {
    goog-composer-location    = "us-central1"
    goog-composer-version     = "composer-1-14-2-airflow-1-10-12"
    goog-dm                   = "us-central1-test-environmen-38573854-sd"
    goog-composer-environment = "test-environment"
  }

  name    = "us-central1-test-environmen-38573854-composer-backend-to-agent-topic-38573854-8b80-4886-bbee-5c96bb6d5b2e"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.us_central1_test_environmen_38573854_composer_backend_to_agent_topic_38573854_8b80_4886_bbee_5c96bb6d5b2e projects/airqo-250220/topics/us-central1-test-environmen-38573854-composer-backend-to-agent-topic-38573854-8b80-4886-bbee-5c96bb6d5b2e
