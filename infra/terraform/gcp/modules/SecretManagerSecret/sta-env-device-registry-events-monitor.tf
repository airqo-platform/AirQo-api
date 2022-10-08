resource "google_secret_manager_secret" "sta_env_device_registry_events_monitor" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-device-registry-events-monitor"
}
# terraform import google_secret_manager_secret.sta_env_device_registry_events_monitor projects/${var.project-number}/secrets/sta-env-device-registry-events-monitor
