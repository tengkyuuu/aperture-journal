#!/usr/bin/env bash
# Deploy Aperture to Cloud Run.
#
#   bash scripts/deploy.sh
#
# Reads the public Firebase config out of .env.local so the client bundle is
# built with it, then deploys the resulting image. The label the Ideathon
# checklist requires is re-applied on every deploy so it cannot be lost by a
# later revision.
set -euo pipefail

PROJECT=aperture-journal
REGION=asia-southeast1
SERVICE=aperture
REPO=asia-southeast1-docker.pkg.dev/$PROJECT/cloud-run-source-deploy
IMAGE=$REPO/$SERVICE:$(date +%Y%m%d-%H%M%S)

set -a; . ./.env.local; set +a

: "${NEXT_PUBLIC_FIREBASE_API_KEY:?missing in .env.local}"
: "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:?missing in .env.local}"
: "${NEXT_PUBLIC_FIREBASE_PROJECT_ID:?missing in .env.local}"

echo "Building $IMAGE"
gcloud builds submit --project="$PROJECT" --config=cloudbuild.yaml \
  --substitutions="_IMAGE=$IMAGE,_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID"

echo "Deploying $SERVICE"
gcloud run deploy "$SERVICE" \
  --project="$PROJECT" --region="$REGION" --image="$IMAGE" \
  --service-account="journal-runtime@$PROJECT.iam.gserviceaccount.com" \
  --labels=dev-tutorial=cloud-run-ai-challenge \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT,GEMINI_SECRET_NAME=GEMINI_API_KEY,APPCHECK_ENFORCE=0" \
  --min-instances=0 --max-instances=3 \
  --allow-unauthenticated

gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format="value(status.url)"
