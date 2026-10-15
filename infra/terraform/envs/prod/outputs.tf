output "frontend_url" {
  value       = "https://${module.frontend.distribution_domain}"
  description = "The only public entry point"
}

output "frontend_bucket" {
  value = module.frontend.bucket_name
}

output "cloudfront_distribution_id" {
  value = module.frontend.distribution_id
}

output "api_dns" {
  value = module.alb.dns_name
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "ecs_cluster" {
  value = aws_ecs_cluster.this.name
}
