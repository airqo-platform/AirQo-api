resource "google_compute_instance_template" "mongos_router_template" {
  confidential_instance_config {
    enable_confidential_compute = false
  }

  description = "This template is used to create mongos query router instances for mongodb sharded clusters."

  disk {
    auto_delete  = true
    boot         = true
    device_name  = "mongos-router-template"
    disk_size_gb = var.disk_size["small"]
    disk_type    = "pd-balanced"
    mode         = "READ_WRITE"
    source_image = var.os["ubuntu-focal"]
    type         = "PERSISTENT"
  }

  labels = {
    managed-by-cnrm = "true"
  }

  machine_type = "e2-standard-2"
  name         = "mongos-router-template"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network = "default"
  }

  project = var.project_id
  region  = var.region

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  service_account {
    email  = "${var.project_number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-shard", "http-server", "https-server"]
}
# terraform import google_compute_instance_template.mongos_router_template projects/${var.project_id}/global/instanceTemplates/mongos-router-template
