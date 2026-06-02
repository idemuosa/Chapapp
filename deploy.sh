#!/bin/bash

# Configuration
REGION="us-east-1" # Change this to your preferred region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PROJECT_NAME="chatapp"

echo "Logging into Amazon ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Function to build and push
build_and_push() {
    local service=$1
    local dockerfile=$2
    local repo_name="$PROJECT_NAME-$service"
    local context="./$service"

    if [ "$service" == "nginx" ]; then
        context="./docker"
    fi

    echo "Processing $service using $dockerfile..."

    # Create repo if not exists
    aws ecr describe-repositories --repository-names $repo_name --region $REGION || \
    aws ecr create-repository --repository-name $repo_name --region $REGION

    # Build
    docker build -t $repo_name -f $dockerfile $context

    # Tag
    docker tag $repo_name:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$repo_name:latest

    # Push
    docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$repo_name:latest
}

# Build and push all services
build_and_push "backend" "backend/Dockerfile.prod"
build_and_push "realtime" "realtime/Dockerfile"
build_and_push "frontend" "frontend/Dockerfile.prod"
build_and_push "nginx" "docker/Dockerfile.nginx"

echo "---------------------------------------------------"
echo "Deployment images pushed to ECR."
echo "ECR Image URLs:"
echo "Backend:  $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$PROJECT_NAME-backend:latest"
echo "Realtime: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$PROJECT_NAME-realtime:latest"
echo "Frontend: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$PROJECT_NAME-frontend:latest"
echo "Nginx:    $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$PROJECT_NAME-nginx:latest"
echo "---------------------------------------------------"
echo "Next step: Update the Image fields in aws-deployment.yml and run:"
echo "aws cloudformation deploy --template-file aws-deployment.yml --stack-name chatapp-stack --capabilities CAPABILITY_IAM"
