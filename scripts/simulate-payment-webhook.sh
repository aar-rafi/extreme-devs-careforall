#!/bin/bash

# Simulate SSL Commerz webhook locally for testing
# Usage: ./simulate-payment-webhook.sh <transaction-id> [success|fail|cancel]

TRANSACTION_ID=$1
STATUS=${2:-success}
API_GATEWAY_URL=${API_GATEWAY_URL:-http://localhost:3000}

if [ -z "$TRANSACTION_ID" ]; then
  echo "Usage: $0 <transaction-id> [success|fail|cancel]"
  echo "Example: $0 CFA-1763725315686-d58b82ce success"
  exit 1
fi

echo "🔄 Simulating $STATUS webhook for transaction: $TRANSACTION_ID"
echo "📍 API Gateway: $API_GATEWAY_URL"

# Generate timestamp and IDs
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")
VAL_ID="SIMULATED-$(date +%s)"
BANK_TRAN_ID="SIMULATED-BANK-$(date +%s)"

# Set status based on parameter
if [ "$STATUS" = "success" ]; then
  SSL_STATUS="VALID"
elif [ "$STATUS" = "fail" ]; then
  SSL_STATUS="FAILED"
else
  SSL_STATUS="CANCELLED"
fi

# IPN webhook payload
IPN_PAYLOAD=$(cat <<EOF
{
  "tran_id": "$TRANSACTION_ID",
  "val_id": "$VAL_ID",
  "amount": "500.00",
  "card_type": "VISA",
  "store_amount": "500.00",
  "card_no": "",
  "bank_tran_id": "$BANK_TRAN_ID",
  "status": "$SSL_STATUS",
  "tran_date": "$TIMESTAMP",
  "currency": "BDT",
  "card_issuer": "SIMULATION BANK",
  "card_brand": "VISA",
  "card_issuer_country": "Bangladesh",
  "card_issuer_country_code": "BD",
  "store_id": "teststore",
  "verify_sign": "simulated_signature",
  "currency_type": "BDT",
  "currency_amount": "500.00",
  "currency_rate": "1.0000",
  "base_fair": "0.00",
  "risk_level": "0",
  "risk_title": "Safe"
}
EOF
)

# Send IPN webhook
echo "📨 Sending IPN webhook..."
IPN_RESPONSE=$(curl -s -X POST \
  "$API_GATEWAY_URL/api/payments/webhook/ipn" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 127.0.0.1" \
  -d "$IPN_PAYLOAD")

echo "Response: $IPN_RESPONSE"

# Send status-specific webhook
echo ""
echo "📨 Sending $STATUS webhook..."

case "$STATUS" in
  "success")
    ENDPOINT="/api/payments/webhook/success"
    ;;
  "fail")
    ENDPOINT="/api/payments/webhook/fail"
    ;;
  "cancel")
    ENDPOINT="/api/payments/webhook/cancel"
    ;;
esac

STATUS_RESPONSE=$(curl -s -X POST \
  "$API_GATEWAY_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 127.0.0.1" \
  -d "$IPN_PAYLOAD")

echo "Response: $STATUS_RESPONSE"

echo ""
echo "✅ Webhook simulation completed!"
echo "Check the payment status with:"
echo "psql -U postgres -d careforall -c \"SELECT id, transaction_id, status FROM payments.payments WHERE transaction_id='$TRANSACTION_ID'\""
