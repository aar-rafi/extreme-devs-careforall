#!/usr/bin/env node

/**
 * Simulate SSL Commerz webhook locally for testing
 * Usage: node simulate-payment-webhook.js <transaction-id> [status]
 * Status can be: success, fail, cancel
 */

const axios = require('axios');

const transactionId = process.argv[2];
const status = process.argv[3] || 'success';

if (!transactionId) {
  console.error('Usage: node simulate-payment-webhook.js <transaction-id> [success|fail|cancel]');
  console.error('Example: node simulate-payment-webhook.js CFA-1763725315686-d58b82ce success');
  process.exit(1);
}

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

// Simulate IPN webhook data from SSL Commerz
const ipnData = {
  tran_id: transactionId,
  val_id: 'SIMULATED-' + Date.now(),
  amount: '500.00',
  card_type: 'VISA',
  store_amount: '500.00',
  card_no: '',
  bank_tran_id: 'SIMULATED-BANK-' + Date.now(),
  status: status === 'success' ? 'VALID' : 'FAILED',
  tran_date: new Date().toISOString(),
  currency: 'BDT',
  card_issuer: 'SIMULATION BANK',
  card_brand: 'VISA',
  card_issuer_country: 'Bangladesh',
  card_issuer_country_code: 'BD',
  store_id: process.env.SSLCOMMERZ_STORE_ID || 'teststore',
  verify_sign: 'simulated_signature',
  verify_key: 'simulated_key',
  verify_sign_sha2: 'simulated_sha2',
  currency_type: 'BDT',
  currency_amount: '500.00',
  currency_rate: '1.0000',
  base_fair: '0.00',
  value_a: '',
  value_b: '',
  value_c: '',
  value_d: '',
  risk_level: '0',
  risk_title: 'Safe'
};

async function simulateWebhook() {
  try {
    console.log(`\n🔄 Simulating ${status} webhook for transaction: ${transactionId}`);
    console.log(`📍 Sending to: ${API_GATEWAY_URL}/api/payments/webhook/ipn`);

    // Send IPN webhook
    const ipnResponse = await axios.post(
      `${API_GATEWAY_URL}/api/payments/webhook/ipn`,
      ipnData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '127.0.0.1', // Simulate external IP
        }
      }
    );

    console.log('✅ IPN webhook sent successfully:', ipnResponse.data);

    // Also send status-specific webhook
    let statusEndpoint = '/api/payments/webhook/';
    let statusData = { ...ipnData };

    switch (status) {
      case 'success':
        statusEndpoint += 'success';
        statusData.status = 'SUCCESS';
        break;
      case 'fail':
        statusEndpoint += 'fail';
        statusData.status = 'FAILED';
        statusData.error = 'Payment failed';
        break;
      case 'cancel':
        statusEndpoint += 'cancel';
        statusData.status = 'CANCELLED';
        break;
    }

    const statusResponse = await axios.post(
      `${API_GATEWAY_URL}${statusEndpoint}`,
      statusData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '127.0.0.1',
        }
      }
    );

    console.log(`✅ ${status} webhook sent successfully:`, statusResponse.data);
    console.log('\n🎉 Payment webhook simulation completed!');
    console.log('Check the payment status in the database to verify it was updated.');

  } catch (error) {
    console.error('❌ Error simulating webhook:', error.response?.data || error.message);
    process.exit(1);
  }
}

simulateWebhook();
