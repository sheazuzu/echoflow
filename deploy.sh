#!/bin/bash

set -e

# MeetAndNote one-click deployment script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

is_true() {
    case "${1:-}" in
        true|TRUE|True|1|yes|YES|Yes|on|ON|On)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

set_env_var() {
    local file="$1"
    local key="$2"
    local value="$3"
    local tmp_file

    tmp_file="$(mktemp)"

    if grep -q "^${key}=" "$file"; then
        awk -v key="$key" -v value="$value" '
            BEGIN { updated = 0 }
            $0 ~ ("^" key "=") {
                print key "=" value
                updated = 1
                next
            }
            { print }
            END {
                if (!updated) {
                    print key "=" value
                }
            }
        ' "$file" > "$tmp_file"
    else
        cat "$file" > "$tmp_file"
        printf '%s=%s\n' "$key" "$value" >> "$tmp_file"
    fi

    mv "$tmp_file" "$file"
}

remove_env_keys() {
    local file="$1"
    local tmp_file

    tmp_file="$(mktemp)"
    grep -vE '^(FRONTEND_RULE|BACKEND_RULE)=' "$file" > "$tmp_file" || true
    mv "$tmp_file" "$file"
}

echo "Echoflow container deployment script"
echo "================================"

CI_MODE=false
if is_true "${CI:-}"; then
    CI_MODE=true
    echo "CI mode detected: all interactive prompts have been disabled"
fi

# Check whether Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first"
    exit 1
fi

# Check whether Docker Compose is installed (supports both formats)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo "Docker Compose is not installed. Please install Docker Compose first"
    exit 1
fi

echo "Using Docker Compose command: $DOCKER_COMPOSE_CMD"

# Check the environment variable file
if [ ! -f ".env" ]; then
    echo ".env file not found. Creating a template..."
    cp .env.example .env
    echo "Please edit the .env file and configure your OpenAI API key"
    echo "   OPENAI_API_KEY=sk-your-actual-api-key"
    exit 1
fi

# Check whether the API key is configured
if grep -q "OPENAI_API_KEY=sk-your-openai-api-key-here" .env; then
    echo "Please configure a valid OpenAI API key in the .env file first"
    exit 1
fi

echo "Environment checks passed"
echo ""

# Read deployment parameters: prefer environment variables, otherwise prompt interactively
DEPLOY_MODE_VALUE="${DEPLOY_MODE:-}"
DOMAIN_NAME_VALUE="${DOMAIN_NAME:-}"
ACME_EMAIL_VALUE="${ACME_EMAIL:-}"

if [ -z "$DEPLOY_MODE_VALUE" ]; then
    if [ "$CI_MODE" = "true" ]; then
        echo "DEPLOY_MODE must be provided in CI mode (1=self-signed certificate, 2=Let's Encrypt)"
        exit 1
    fi

    echo "Configure HTTPS certificates..."
    echo "Select deployment mode:"
    echo "1) Private deployment (use a self-signed certificate, suitable for internal networks or testing)"
    echo "2) Cloud server deployment (use a free Let's Encrypt certificate, requires a public IP and a domain name)"
    read -r -p "Enter your choice (1/2): " DEPLOY_MODE_VALUE
else
    echo "Using deployment mode from environment variables: $DEPLOY_MODE_VALUE"
fi

case "$DEPLOY_MODE_VALUE" in
    1|2)
        ;;
    *)
        if [ "$CI_MODE" = "true" ] || [ -n "${DEPLOY_MODE:-}" ]; then
            echo "DEPLOY_MODE must be 1 or 2"
            exit 1
        fi
        echo "Invalid option. Falling back to private deployment mode"
        DEPLOY_MODE_VALUE="1"
        ;;
esac

if [ "$DEPLOY_MODE_VALUE" = "2" ]; then
    if [ -z "$DOMAIN_NAME_VALUE" ]; then
        if [ "$CI_MODE" = "true" ]; then
            echo "DOMAIN_NAME must be provided when DEPLOY_MODE=2 in CI mode"
            exit 1
        fi
        read -r -p "Enter your domain name (for example: example.com): " DOMAIN_NAME_VALUE
    fi

    if [ -z "$DOMAIN_NAME_VALUE" ]; then
        echo "Domain name cannot be empty"
        exit 1
    fi

    if [ -z "$ACME_EMAIL_VALUE" ]; then
        if [ "$CI_MODE" = "true" ]; then
            echo "ACME_EMAIL must be provided when DEPLOY_MODE=2 in CI mode"
            exit 1
        fi
        read -r -p "Enter your email address (used for Let's Encrypt notifications): " ACME_EMAIL_VALUE
    fi

    if [ -z "$ACME_EMAIL_VALUE" ]; then
        echo "Email address cannot be empty"
        exit 1
    fi
fi

# Create required directories
mkdir -p traefik/certs
mkdir -p traefik/dynamic
mkdir -p traefik/letsencrypt

# Clean old routing rules to ensure a clean state
remove_env_keys .env

if [ "$DEPLOY_MODE_VALUE" = "1" ]; then
    echo "Configuring private deployment environment..."

    # Generate a self-signed certificate
    if [ ! -f "traefik/certs/server.crt" ]; then
        echo "Generating self-signed certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout traefik/certs/server.key \
            -out traefik/certs/server.crt \
            -subj "/CN=localhost"
    fi

    # Generate the dynamic configuration file to load the certificate
    cat > traefik/dynamic/tls.yml <<EOF
tls:
  stores:
    default:
      defaultCertificate:
        certFile: /certs/server.crt
        keyFile: /certs/server.key
EOF

    # Remove the override file if it exists
    rm -f docker-compose.override.yml

    echo "Self-signed certificate configuration completed"

elif [ "$DEPLOY_MODE_VALUE" = "2" ]; then
    echo "Configuring cloud server environment..."

    # Update email and routing rules in .env
    set_env_var .env "ACME_EMAIL" "$ACME_EMAIL_VALUE"
    set_env_var .env "FRONTEND_RULE" "Host(\`$DOMAIN_NAME_VALUE\`)"
    set_env_var .env "BACKEND_RULE" "Host(\`$DOMAIN_NAME_VALUE\`) && PathPrefix(\`/api\`)"

    # Ensure acme.json exists and has the correct permission (600)
    if [ ! -f "traefik/letsencrypt/acme.json" ]; then
        touch traefik/letsencrypt/acme.json
    fi
    chmod 600 traefik/letsencrypt/acme.json

    # Create the override file to enable the ACME resolver
    cat > docker-compose.override.yml <<EOF
version: '3'
services:
  frontend:
    labels:
      - "traefik.http.routers.frontend.tls.certresolver=myresolver"
  backend:
    labels:
      - "traefik.http.routers.backend.tls.certresolver=myresolver"
EOF

    # Remove the dynamic TLS configuration to avoid conflicts
    rm -f traefik/dynamic/tls.yml

    echo "Let's Encrypt configuration completed (domain: $DOMAIN_NAME_VALUE)"
fi

# Build and start services
echo "Building Docker images..."
$DOCKER_COMPOSE_CMD build

echo ""
echo "Starting services..."
$DOCKER_COMPOSE_CMD up -d

echo ""
echo "Waiting for services to start..."
echo "   Waiting for Traefik and services to fully start..."

# Wait until containers become healthy
for i in {1..30}; do
    if $DOCKER_COMPOSE_CMD ps | grep -q "healthy"; then
        echo "All services are healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Timeout reached: some services are still starting, continuing with health checks..."
    fi
    sleep 2
done

echo "   Waiting for Traefik routes to be registered..."
sleep 5

# Check service status
echo ""
echo "Service status:"
$DOCKER_COMPOSE_CMD ps

echo ""
echo "Service health checks:"

# Check the backend service through Traefik
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "Backend service is running normally (through Traefik: /api/health)"
else
    echo "Backend service failed to start (cannot access /api/health through Traefik)"
fi

# Check the frontend service through Traefik
if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "Frontend service is running normally (through Traefik: /)"
else
    echo "Frontend service failed to start (cannot access / through Traefik)"
fi

# Check SMTP configuration and connectivity
echo ""
echo "SMTP mail service check:"

# Check whether SMTP is configured in the .env file
if [ -f ".env" ]; then
    SMTP_HOST=$(grep "^SMTP_HOST=" .env | cut -d '=' -f2)
    SMTP_USER=$(grep "^SMTP_USER=" .env | cut -d '=' -f2)
    SMTP_PASS=$(grep "^SMTP_PASS=" .env | cut -d '=' -f2)

    # Check which configuration items are missing
    MISSING_CONFIGS=()
    [ -z "$SMTP_HOST" ] && MISSING_CONFIGS+=("SMTP_HOST")
    [ -z "$SMTP_USER" ] && MISSING_CONFIGS+=("SMTP_USER")
    [ -z "$SMTP_PASS" ] && MISSING_CONFIGS+=("SMTP_PASS")

    if [ ${#MISSING_CONFIGS[@]} -gt 0 ]; then
        echo "SMTP configuration is incomplete. Email sending will not be available"
        echo ""
        echo "Missing configuration items:"
        for config in "${MISSING_CONFIGS[@]}"; do
            case $config in
                "SMTP_HOST")
                    echo "   $config - Enter the SMTP server address (for example: smtp.gmail.com)"
                    ;;
                "SMTP_USER")
                    echo "   $config - Enter the sender email address (for example: your-email@gmail.com)"
                    ;;
                "SMTP_PASS")
                    echo "   $config - Enter the email password or app-specific password"
                    echo "      Tip: Gmail requires an app-specific password, not your regular sign-in password"
                    ;;
            esac
        done
        echo ""
        echo "Please configure the above variables in the .env file under the project root"
        echo "   Example configuration:"
        echo "   SMTP_HOST=smtp.gmail.com"
        echo "   SMTP_PORT=587"
        echo "   SMTP_SECURE=false"
        echo "   SMTP_USER=your-email@gmail.com"
        echo "   SMTP_PASS=your-app-password"
    else
        # Read all SMTP configuration values
        SMTP_PORT=$(grep "^SMTP_PORT=" .env | cut -d '=' -f2)
        SMTP_SECURE=$(grep "^SMTP_SECURE=" .env | cut -d '=' -f2)

        # Set default values
        SMTP_PORT=${SMTP_PORT:-587}
        SMTP_SECURE=${SMTP_SECURE:-false}

        echo "SMTP configuration found (server: $SMTP_HOST)"
        echo "   Testing SMTP connectivity..."

        # Use Node.js to test SMTP connectivity and pass configuration values directly
        SMTP_TEST_RESULT=$($DOCKER_COMPOSE_CMD exec -T backend node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: '$SMTP_HOST',
    port: parseInt('$SMTP_PORT'),
    secure: '$SMTP_SECURE' === 'true',
    auth: {
        user: '$SMTP_USER',
        pass: '$SMTP_PASS',
    },
    // Increase timeouts to reduce failures caused by unstable networks or DNS resolution issues
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
});
transporter.verify()
    .then(() => console.log('SUCCESS'))
    .catch(err => console.log('FAILED:' + err.message));
" 2>&1)

        if echo "$SMTP_TEST_RESULT" | grep -q "SUCCESS"; then
            echo "   SMTP server connection succeeded. Email sending is ready"
        else
            echo "   SMTP server connection failed"
            ERROR_MSG=$(echo "$SMTP_TEST_RESULT" | grep "FAILED:" | cut -d ':' -f2-)
            if [ -n "$ERROR_MSG" ]; then
                echo "   Error message: $ERROR_MSG"
            fi
            echo "   Please check whether the SMTP configuration is correct"
            echo "   Current configuration: $SMTP_HOST:$SMTP_PORT (secure=$SMTP_SECURE)"
        fi
    fi
else
    echo ".env file not found. Unable to check SMTP configuration"
fi

echo ""
echo "Deployment completed"
echo ""
echo "Access URLs:"
echo "   Frontend: http://localhost/"
echo "   Backend API: http://localhost/api/"
echo "   Traefik dashboard: http://localhost:8080/ (development environment only)"
echo ""
echo "Common commands:"
echo "   View logs: $DOCKER_COMPOSE_CMD logs -f"
echo "   Stop services: $DOCKER_COMPOSE_CMD down"
echo "   Redeploy: $DOCKER_COMPOSE_CMD up -d --build"
echo ""
echo "Tip: Before first use, make sure you have configured a valid OpenAI API key in the .env file"
