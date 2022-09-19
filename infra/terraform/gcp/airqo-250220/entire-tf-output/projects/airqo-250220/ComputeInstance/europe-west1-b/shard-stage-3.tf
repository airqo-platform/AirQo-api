resource "google_compute_instance" "shard_stage_3" {
  boot_disk {
    auto_delete = true
    device_name = "shard-dev-1"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 100
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/shard-stage-3"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-medium"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBGHUfKskMmTW9tP4K5NAOB/RBI8XMJgpMfSVSWh1SKfaN7JY68n82AICImsjPRMjZr5y1zg/bw+jtnPKLiZcHnI= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T13:15:28+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCvMmubQdFKSRqbuf2p6nCUtkdZ66aXWOIh9ahD1pKzR7ykDfJuPeRSTSpwmz5d3/0F3E4vCSqMXlKDzwuUMtkWYR9/W5596w3MCDtek4Hk8nnug0p25cRXza6yu2EruVWvqRdWfGrxbb92aLKiO5bAjSMVYMEaJgmWcZGZ1ZeDMwfryinXVHmPF/GTNaIxP8A6T0BBpzNBdy4l3zqPemg41cGLzTDsRljwogwJMKTmMCxG8ynzZw9B9b7Dca+rK8cekkt2Od4d5SAccIIP5gcws3lcVQzJbRbbO8IKV5S64ZYcwq9bAH14HW6BOwPmHwLKx0asua5/zlF9T+X1uOXz google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-12T13:15:46+0000\"}"
  }

  name = "shard-stage-3"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.97"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
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
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-shard", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.shard_stage_3 projects/airqo-250220/zones/europe-west1-b/instances/shard-stage-3
