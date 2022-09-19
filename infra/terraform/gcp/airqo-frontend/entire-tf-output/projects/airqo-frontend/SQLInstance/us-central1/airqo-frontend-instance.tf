resource "google_sql_database_instance" "airqo_frontend_instance" {
  database_version = "MYSQL_5_7"
  name             = "airqo-frontend-instance"
  project          = "airqo-frontend"
  region           = "us-central1"

  settings {
    activation_policy = "ALWAYS"
    availability_type = "ZONAL"

    backup_configuration {
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }

      binary_log_enabled             = true
      enabled                        = true
      start_time                     = "10:00"
      transaction_log_retention_days = 7
    }

    disk_autoresize       = true
    disk_autoresize_limit = 0
    disk_size             = 10
    disk_type             = "PD_SSD"

    ip_configuration {
      ipv4_enabled = true
    }

    location_preference {
      zone = "us-central1-c"
    }

    pricing_plan = "PER_USE"
    tier         = "db-n1-standard-1"
  }
}
# terraform import google_sql_database_instance.airqo_frontend_instance projects/airqo-frontend/instances/airqo-frontend-instance
