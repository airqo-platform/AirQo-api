resource "google_sql_database_instance" "mlflow_backend" {
  database_version = "MYSQL_5_7"
  name             = "mlflow-backend"
  project          = "airqo-250220"
  region           = "us-central1"

  settings {
    activation_policy = "ALWAYS"
    availability_type = "ZONAL"

    backup_configuration {
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }

      start_time                     = "09:00"
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
    tier         = "db-f1-micro"
  }
}
# terraform import google_sql_database_instance.mlflow_backend projects/airqo-250220/instances/mlflow-backend
