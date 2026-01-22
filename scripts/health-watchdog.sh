#!/bin/bash
# Health Watchdog for Jubilee Enterprise Services
# Checks external endpoints and restarts cloudflared if 502 detected
# Run via cron every 2 minutes: */2 * * * * /opt/jubilee/scripts/health-watchdog.sh

LOG_FILE="/home/eliana/logs/jubilee-watchdog.log"
CRITICAL_ENDPOINTS=(
    "https://inspirecodex.com/health"
    "https://jubileeverse.com/"
    "https://jubileeinspire.com/"
)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_endpoint() {
    local url=$1
    local status=$(curl -s -o /dev/null -w '%{http_code}' "$url" --max-time 10 2>/dev/null)
    echo "$status"
}

restart_cloudflared() {
    log "ALERT: Restarting cloudflared due to 502 errors"
    pkill -9 cloudflared
    sleep 3
    systemctl start cloudflared
    sleep 10
    log "cloudflared restarted"
}

# Main check loop
failures=0
for endpoint in "${CRITICAL_ENDPOINTS[@]}"; do
    status=$(check_endpoint "$endpoint")
    if [[ "$status" == "502" ]] || [[ "$status" == "000" ]]; then
        log "FAILED: $endpoint returned $status"
        ((failures++))
    fi
done

# If any critical endpoint returns 502, restart cloudflared
if [[ $failures -gt 0 ]]; then
    log "Detected $failures failed endpoints"
    restart_cloudflared

    # Re-check after restart
    sleep 5
    for endpoint in "${CRITICAL_ENDPOINTS[@]}"; do
        status=$(check_endpoint "$endpoint")
        log "POST-RESTART: $endpoint returned $status"
    done
else
    # Silent success - only log every 30 minutes
    minute=$(date +%M)
    if [[ "$minute" == "00" ]] || [[ "$minute" == "30" ]]; then
        log "OK: All ${#CRITICAL_ENDPOINTS[@]} critical endpoints healthy"
    fi
fi
