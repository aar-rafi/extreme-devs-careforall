#!/bin/bash

# This script sets up ngrok to expose local webhooks for SSL Commerz testing
# Prerequisites: Install ngrok first: https://ngrok.com/download

echo "Setting up ngrok for SSL Commerz webhook testing..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok is not installed. Please install it from https://ngrok.com/download"
    exit 1
fi

# Start ngrok on port 3000 (API Gateway)
echo "Starting ngrok tunnel to expose API Gateway (port 3000)..."
ngrok http 3000 --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get the public URL from ngrok
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

if [ -z "$NGROK_URL" ]; then
    echo "Failed to get ngrok URL. Make sure ngrok is running correctly."
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo "✅ Ngrok tunnel established!"
echo "Public URL: $NGROK_URL"
echo ""
echo "⚠️  IMPORTANT: Update your .env file with:"
echo "API_GATEWAY_URL=$NGROK_URL"
echo ""
echo "This will allow SSL Commerz to send webhooks to:"
echo "- IPN: $NGROK_URL/api/payments/webhook/ipn"
echo "- Success: $NGROK_URL/api/payments/webhook/success"
echo "- Fail: $NGROK_URL/api/payments/webhook/fail"
echo "- Cancel: $NGROK_URL/api/payments/webhook/cancel"
echo ""
echo "Press Ctrl+C to stop ngrok tunnel"

# Keep the script running
wait $NGROK_PID
