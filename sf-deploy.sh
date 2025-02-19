#!/bin/bash

# Script for deploying nodejs applications to the SF cloud ™.
# Requirements:
# - ssh access
# - application name in package.json or provided as env var GIT_URL
# - git url in package.json or provided as env var GIT_URL
# - package-lock.json
# - npm scripts "build" and "start"
# Optional:
# - .nvmrc file signalling the wanted node version
# - .env.prod with env vars to be used in production
#
# When running for an existing app, it will:
# - update the .env file based on the local .env.prod
# - update the repo
# - update dependencies (npm ci)
# - build the app (npm run build)
# - restart the service
#
# When running for a new app, it will additionally first:
# - clone the repo
# - create a user systemd unit

set -eu

SSH_HOST=dapps@main.x.superfluid.dev
APP_NAME=${APP_NAME:-$(cat package.json | jq -r '.name')}
GIT_URL=${GIT_URL:-$(cat package.json | jq -r '.repository.url')}
SERVICE_FILE=$APP_NAME.service

echo "APP_NAME: $APP_NAME"
if [ -z "$APP_NAME" ] || [[ "$APP_NAME" =~ ' ' ]]; then
  echo "Invalid app name"
  exit 1
fi

echo "GIT_URL: $GIT_URL"
if [ -z "$GIT_URL" ]; then
  echo "Invalid git url"
  exit 1
fi

# if there's a local .env.prod, copy it to the server with the name .env.$APP_NAME
if [ -f ".env.prod" ]; then
  echo "Using .env.prod for the production environment"
  scp .env.prod $SSH_HOST:~/.env.$APP_NAME
fi

# if any of the commands fails, don't continue
ssh -q -T $SSH_HOST "/bin/bash --noprofile --norc" <<EOF
set -e
set -u
. .nvm/nvm.sh

# (conditional) first time setup

# if directory with app name doesn't exist, clone the repo
if [ ! -d "$APP_NAME" ]; then
  echo "Cloning repo"
  git clone $GIT_URL $APP_NAME
fi

# if service file doesn't exist, copy it from the template
if [ ! -f "services/$SERVICE_FILE" ]; then
  echo "Copying service file"
  cp template.service services/$SERVICE_FILE
  sed -i "s|Description=|Description=$APP_NAME|" services/$SERVICE_FILE
  sed -i "s|WorkingDirectory=|WorkingDirectory=/home/dapps/$APP_NAME|" services/$SERVICE_FILE
  systemctl --user daemon-reload
  sleep 1
  systemctl --user enable $SERVICE_FILE
fi

# regular update

# if there's an .env.$APP_NAME, use it
if [ -f ".env.$APP_NAME" ]; then
  echo "Using .env.$APP_NAME for the production environment"
  cp .env.$APP_NAME $APP_NAME/.env
  rm .env.$APP_NAME
else
  echo "No .env.$APP_NAME found"
fi

cd $APP_NAME
git pull
if [ -f .nvmrc ]; then
  nvm use
else
  echo "no .nvmrc provided, using default node version"
fi
node --version
npm ci
npm run build
cd
systemctl --user restart $SERVICE_FILE
systemctl --user -n 50 status $SERVICE_FILE
EOF