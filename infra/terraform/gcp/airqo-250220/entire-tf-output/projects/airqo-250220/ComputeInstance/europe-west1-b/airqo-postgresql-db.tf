resource "google_compute_instance" "airqo_postgresql_db" {
  boot_disk {
    auto_delete = true
    device_name = "airqo-postgresql-db"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20211212"
      size  = 50
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-postgresql-db"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-small"

  name = "airqo-postgresql-db"

  network_interface {
    access_config {
      nat_ip       = "34.79.143.111"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
    network_ip         = "10.132.0.26"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/default"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-postgresql-db", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_postgresql_db projects/airqo-250220/zones/europe-west1-b/instances/airqo-postgresql-db
