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

  metadata = {
    ssh-keys = "noah:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBPwk1fdhOTjflGhb0gtu5TLj26Aq4wPx+pGkFvWyxCwBnE7WlmXkQAuXJZthOwifRrsDyoOv4SvjDkgfSi1eFFE= google-ssh {\"userName\":\"noah@airqo.net\",\"expireOn\":\"2022-09-02T12:07:23+0000\"}\nnoah:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCHutjAKYiCJe9DlU7fAMPZtjMiJVjulkDTttuiu+8HOuHA69WKi3jaQfVoLQzs6BikTaex1W5JSd0OYF3PZpz7bLTCqyF9mX13rMTuqPklRLBx1t/s1X1Z4g6FV/7qmrBLb+KXb3YOYteEFleY/P4U0P2nWJ7fa2JSw3hWV/YB81xqbQZpoeBfVXBkJDjz3R3ZQCiV1EFR91YXyj3wv4a91YfJuF+Zu8Zjjb0olJcsecjLbcgJEkkBODjmBIgCKg0MdxlgVd9FtHPXcuemul/vXue2ogatdzqF0y3ood0mOmKX/XO7Loya1PPYJ+CWr3U/k1M5OuZ2mA4EwcVCTRSX google-ssh {\"userName\":\"noah@airqo.net\",\"expireOn\":\"2022-09-02T12:07:38+0000\"}"
  }

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
