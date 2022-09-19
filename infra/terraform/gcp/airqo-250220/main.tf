provider "google" {
  project = "airqo-250220"
}

## As of Sept/2022, the provider hashicorp/google does not support
## resource type "google_iam_custom_role"
# module "resources-projects-airqo-250220-IAMCustomRole" {
#  source = "./resources/projects/airqo-250220/IAMCustomRole"
# }


module "resources-projects-airqo-250220-ComputeURLMap-global" {
  source = "./resources/projects/airqo-250220/ComputeURLMap/global"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-australia-southeast1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/australia-southeast1"
}


module "resources-projects-airqo-250220-ComputeRouter-us-central1" {
  source = "./resources/projects/airqo-250220/ComputeRouter/us-central1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-south1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-south1"
}


module "resources-airqo-250220-BigQueryDataset-europe-west6" {
  source = "./resources/airqo-250220/BigQueryDataset/europe-west6"
}


module "resources-projects-airqo-250220-ComputeAddress-europe-west1" {
  source = "./resources/projects/airqo-250220/ComputeAddress/europe-west1"
}


module "resources-projects-airqo-250220-ComputeAddress-us-central1" {
  source = "./resources/projects/airqo-250220/ComputeAddress/us-central1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-east5" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-east5"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-west9" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-west9"
}


module "resources-projects-airqo-250220-StorageBucket-EUROPE-WEST1" {
  source = "./resources/projects/airqo-250220/StorageBucket/EUROPE-WEST1"
}


module "resources-projects-airqo-250220-ComputeForwardingRule-us-central1" {
  source = "./resources/projects/airqo-250220/ComputeForwardingRule/us-central1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-west4" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-west4"
}


module "resources-airqo-250220-ComputeDisk-europe-west1-b" {
  source = "./resources/airqo-250220/ComputeDisk/europe-west1-b"
}


module "resources-projects-airqo-250220-IAMServiceAccount" {
  source = "./resources/projects/airqo-250220/IAMServiceAccount"
}


module "resources-projects-airqo-250220-KMSKeyRing-eur3" {
  source = "./resources/projects/airqo-250220/KMSKeyRing/eur3"
}


module "resources-projects-airqo-250220-ComputeForwardingRule-global" {
  source = "./resources/projects/airqo-250220/ComputeForwardingRule/global"
}


## As of Sept/2022, the provider hashicorp/google does not support resource type
## "google_logging_log_sink" on line 1 of the file a-required.tf
# module "resources-702081712633-702081712633-Project-LoggingLogSink" {
#  source = "./resources/702081712633/702081712633/Project/LoggingLogSink"
# }


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-southeast1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-southeast1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-australia-southeast2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/australia-southeast2"
}


module "resources-projects-airqo-250220-ComputeBackendBucket" {
  source = "./resources/projects/airqo-250220/ComputeBackendBucket"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-northamerica-northeast1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/northamerica-northeast1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-northeast3" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-northeast3"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-southamerica-east1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/southamerica-east1"
}


module "resources-projects-airqo-250220-StorageBucket-EU" {
  source = "./resources/projects/airqo-250220/StorageBucket/EU"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-northeast1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-northeast1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-west6" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-west6"
}


module "resources-projects-airqo-250220-ComputeFirewall" {
  source = "./resources/projects/airqo-250220/ComputeFirewall"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-southeast2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-southeast2"
}


module "resources-airqo-250220-BigQueryDataset-US" {
  source = "./resources/airqo-250220/BigQueryDataset/US"
}


module "resources-702081712633-Service" {
  source = "./resources/702081712633/Service"
}


module "resources-projects-airqo-250220-StorageBucket-EUROPE-WEST2" {
  source = "./resources/projects/airqo-250220/StorageBucket/EUROPE-WEST2"
}


module "resources-projects-airqo-250220-StorageBucket-US-CENTRAL1" {
  source = "./resources/projects/airqo-250220/StorageBucket/US-CENTRAL1"
}


module "resources-projects-airqo-250220-StorageBucket-US" {
  source = "./resources/projects/airqo-250220/StorageBucket/US"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-west1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-west1"
}


module "resources-projects-airqo-250220-SQLInstance-us-central1" {
  source = "./resources/projects/airqo-250220/SQLInstance/us-central1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-south1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-south1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-east1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-east1"
}


module "resources-projects-airqo-250220-ComputeTargetPool-us-central1" {
  source = "./resources/projects/airqo-250220/ComputeTargetPool/us-central1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-central2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-central2"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-west4" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-west4"
}


module "resources-projects-702081712633-SecretManagerSecret" {
  source = "./resources/projects/702081712633/SecretManagerSecret"
}


module "resources-airqo-250220-ComputeDisk-us-central1-a" {
  source = "./resources/airqo-250220/ComputeDisk/us-central1-a"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-west3" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-west3"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-north1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-north1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-west3" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-west3"
}


module "resources-projects-airqo-250220-ComputeRoute" {
  source = "./resources/projects/airqo-250220/ComputeRoute"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-west2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-west2"
}


module "resources-airqo-250220-BigQueryDataset-EU" {
  source = "./resources/airqo-250220/BigQueryDataset/EU"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-central1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-central1"
}


module "resources-projects-airqo-250220-ComputeInstanceTemplate-europe-west1" {
  source = "./resources/projects/airqo-250220/ComputeInstanceTemplate/europe-west1"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-east4" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-east4"
}


module "resources-airqo-250220-ComputeDisk-us-east1-b" {
  source = "./resources/airqo-250220/ComputeDisk/us-east1-b"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-southamerica-west1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/southamerica-west1"
}


module "resources-projects-airqo-250220-KMSKeyRing-locations-eur3-keyRings-airqo-api-KMSCryptoKey" {
  source = "./resources/projects/airqo-250220/KMSKeyRing/locations/eur3/keyRings/airqo-api/KMSCryptoKey"
}


module "resources-projects-airqo-250220-PubSubSubscription" {
  source = "./resources/projects/airqo-250220/PubSubSubscription"
}


module "resources-projects-airqo-250220-ComputeInstance-us-central1-a" {
  source = "./resources/projects/airqo-250220/ComputeInstance/us-central1-a"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-west1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-west1"
}


module "resources-projects-airqo-250220-BigQueryTable" {
  source = "./resources/projects/airqo-250220/BigQueryTable"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-northeast2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-northeast2"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-west8" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-west8"
}


module "resources-projects-airqo-250220-ComputeInstance-europe-west1-b" {
  source = "./resources/projects/airqo-250220/ComputeInstance/europe-west1-b"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-east1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-east1"
}


module "resources-projects-airqo-250220-PubSubTopic" {
  source = "./resources/projects/airqo-250220/PubSubTopic"
}


module "resources-projects-airqo-250220-ComputeSnapshot" {
  source = "./resources/projects/airqo-250220/ComputeSnapshot"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-northamerica-northeast2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/northamerica-northeast2"
}


module "resources-projects-airqo-250220-ComputeAddress-europe-west2" {
  source = "./resources/projects/airqo-250220/ComputeAddress/europe-west2"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-south2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-south2"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-us-west2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/us-west2"
}


module "resources-projects-airqo-250220-ComputeTargetHTTPProxy-global" {
  source = "./resources/projects/airqo-250220/ComputeTargetHTTPProxy/global"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-asia-east2" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/asia-east2"
}


module "resources-projects-airqo-250220-ComputeNetwork" {
  source = "./resources/projects/airqo-250220/ComputeNetwork"
}


module "resources-projects-airqo-250220-ComputeSubnetwork-europe-southwest1" {
  source = "./resources/projects/airqo-250220/ComputeSubnetwork/europe-southwest1"
}


module "resources-projects-airqo-250220-StorageBucket-NAM4" {
  source = "./resources/projects/airqo-250220/StorageBucket/NAM4"
}


module "resources-projects-airqo-250220-ComputeHTTPHealthCheck" {
  source = "./resources/projects/airqo-250220/ComputeHTTPHealthCheck"
}

