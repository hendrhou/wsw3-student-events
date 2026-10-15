provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "campus-pulse"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}
