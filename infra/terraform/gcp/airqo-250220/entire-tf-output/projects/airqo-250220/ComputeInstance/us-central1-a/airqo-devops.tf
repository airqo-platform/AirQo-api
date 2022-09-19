resource "google_compute_instance" "airqo_devops" {
  boot_disk {
    auto_delete = true
    device_name = "airqo-devops"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1604-xenial-v20200129"
      size  = 200
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/us-central1-a/disks/airqo-devops"
  }

  machine_type = "custom-1-7424-ext"

  metadata = {
    ssh-keys       = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBOP3ccHx2+DF8/kw056ckDWo/7XnlO3MHuSIoBQVl7Wwqgmsn2j7btFtIWoJvDsNvqZhopItg/6sf2DHMRB+9ak= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-06-06T07:15:48+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCTLZfp25P238Wuy5N6FyuycCuQKPyMgSPKVFUMc+DWjOnq/MA6w8G2medgbgOahZwhI5wAl9doT/iR3xd3LjbV1ASyrFC6L0i2KPM1WxSqzsqrYNAI0Sb42MXntzSmCUfldd7WqdeXge/9WRoXft2/tjgeVMFqmODPQeMZY42hdZGZqsQeIrcphLFAGHajVPWNlARJhi4djRovA3VaEp+/ZKB9r07UKGrEBD/x4vUv6eg3SAuArZpB1mQpqpdTqYp8latW3erNQZuU54gdR6qP3a10uY47XrgjNGYR7fHHsrsFWqjR9FItojXDposjL7J4MkOD5Fpmg2q/fG0oNkQv google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-06-06T07:16:03+0000\"}"
    startup-script = "sudo ufw allow ssh"
  }

  name = "airqo-devops"

  network_interface {
    access_config {
      nat_ip       = "35.224.67.244"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
    network_ip         = "10.128.0.62"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/us-central1/subnetworks/default"
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

  tags = ["http-server", "https-server"]
  zone = "us-central1-a"
}
# terraform import google_compute_instance.airqo_devops projects/airqo-250220/zones/us-central1-a/instances/airqo-devops
