resource "google_secret_manager_secret" "sta_env_device_registry_events_monitor" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-device-registry-events-monitor"
}
# terraform import google_secret_manager_secret.sta_env_device_registry_events_monitor projects/702081712633/secrets/sta-env-device-registry-events-monitor
