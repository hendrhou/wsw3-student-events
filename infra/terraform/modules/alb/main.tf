# Public ALB whose only job is /api/* → Kong. Reachable from CloudFront (and
# directly during early testing). Everything behind it is private.

variable "project" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }

resource "aws_security_group" "alb" {
  name   = "${var.project}-alb"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # tightened to the CloudFront prefix list when HTTPS lands
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "api" {
  name               = "${var.project}-api"
  load_balancer_type = "application"
  internal           = false
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]
  tags               = { Project = var.project }
}

resource "aws_lb_target_group" "kong" {
  name        = "${var.project}-kong"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path                = "/api/status" # Kong's declarative status endpoint
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      status_code  = "404"
      message_body = "not found"
    }
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  condition {
    path_pattern { values = ["/api/*"] }
  }
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.kong.arn
  }
}

output "dns_name" { value = aws_lb.api.dns_name }
output "kong_target_group_arn" { value = aws_lb_target_group.kong.arn }
output "security_group_id" { value = aws_security_group.alb.id }
