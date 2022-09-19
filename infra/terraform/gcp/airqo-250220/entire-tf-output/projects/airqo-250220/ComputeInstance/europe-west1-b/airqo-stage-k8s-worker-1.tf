resource "google_compute_instance" "airqo_stage_k8s_worker_1" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20210720"
      size  = 100
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-k8s-worker-1"
  }

  can_ip_forward = true
  machine_type   = "c2-standard-4"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNIcFBYsvWmoccsztX7KGRl2gkxaWX+2qxuPqtjYbpoAZoc8kequ/TQaGRLZjwhtpiUwb22rCDcDPvAVQNCJ9Hw= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-25T07:25:29+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAHVDLjPLZ2rmjnlItdJiSi2BjCe9d0SWWJ0RZMypBXtScou9wKNlLIdQdVQKaYDgR9u+ecoPVfd57V50g/supapcvs6fwl86V2VKqplsvSvJoAzjCpYd92ssuMgH+HauqrpTeuMB4JoGiDtJBGM5eUxZoEljb3JpbyJOEE+E/vKxg4alyAcP1pblXKHHs4mlGwpWsNlfc0D+sOAzI72XUUOU9n2BN1AjchotkUNPYe7Z8zpQleooTRmAwgnt+eSHZYapn47F/Yin00ImQae1Y1entxtuJxKEg0A8vTz6O2kob8UTDhzuym0Zzz2cR0VN5AV2YyjVO5VZZTpxLLQ4Usc= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-25T07:25:45+0000\"}\nmikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBBbCnCWc91Yyw9qqpNUCPb63DJHIhfgAAPKoA9HhbUUuB8yLgt5ZyEP12ICT29QaSYBlwBeLjetaLDME9t8i1Oo= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-25T07:27:10+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC9wUMmW5m+/A5RRH9vYERAFIpojs4n6azWYd0zJuQgcfgciOucZ7VCouYYgORLkOgr7Wd0W0De9mNNi5NquDCYRjUGKOKazZWKF+HVIIYOWd82mBaMsP22UIyIe5pAaBseAGNxiSIt0NO6haZdr1zS4wXHT78iN+BZBmQQ89Njg+cuCKJMCv3i+m3/q5SUOzZR0z5wEQlJvaAcsIpNwBobhASofWJiZSBtFZJ1TgoIFM+7ggsVfNJNrzbhW8R83O5eLJOmYCtKpiE1fNjjDYH+oJN3fwFoI+GKcxYH5ydAKTiYHRPK45C1oVT9oUFhe3AemY+350tdQR0+rFhQPQAV google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-08-25T07:27:25+0000\"}"
  }

  name = "airqo-stage-k8s-worker-1"

  network_interface {
    access_config {
      nat_ip       = "34.79.228.66"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.102"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s-cluster", "worker"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_stage_k8s_worker_1 projects/airqo-250220/zones/europe-west1-b/instances/airqo-stage-k8s-worker-1
