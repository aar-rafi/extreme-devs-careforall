'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { paymentsApi } from '@/lib/api/payments';
import { pledgesApi } from '@/lib/api/pledges';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pledgeId = searchParams.get('pledge');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [pledgeData, setPledgeData] = useState<any>(null);

  useEffect(() => {
    if (!pledgeId) {
      setError('Invalid payment reference');
      setLoading(false);
      return;
    }

    verifyPayment(pledgeId);
  }, [pledgeId]);

  const verifyPayment = async (pledgeId: string, attempt = 0) => {
    const maxAttempts = 10;

    try {
      // Wait 2 seconds on first attempt for webhook to process
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Fetch payment and pledge data
      const [paymentResponse, pledgeResponse] = await Promise.all([
        paymentsApi.getByPledgeId(pledgeId),
        pledgesApi.getById(pledgeId),
      ]);

      const payment = paymentResponse.data;
      const pledge = pledgeResponse.data;

      // Check if payment is completed
      if (payment.status === 'completed') {
        setPaymentData(payment);
        setPledgeData(pledge);
        setLoading(false);
      } else if (payment.status === 'failed') {
        setError('Payment failed. Please try again.');
        setLoading(false);
      } else if (payment.status === 'pending' && attempt >= 3) {
        // Sandbox mode: Show pending payment after 3 attempts (9 seconds)
        setPaymentData(payment);
        setPledgeData(pledge);
        setError(
          'Payment is being processed. In sandbox mode, this may take some time. Your pledge has been recorded.'
        );
        setLoading(false);
      } else if (attempt < maxAttempts) {
        // Still pending, poll again after 3 seconds
        setTimeout(() => verifyPayment(pledgeId, attempt + 1), 3000);
      } else {
        // Timeout - show warning but display data
        setPaymentData(payment);
        setPledgeData(pledge);
        setError(
          'Payment verification is taking longer than expected. Please check your email for confirmation or contact support.'
        );
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setError(err.response?.data?.error?.message || 'Failed to verify payment');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold mb-2">Verifying your payment...</h2>
                <p className="text-muted-foreground">
                  Please wait while we confirm your donation.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !paymentData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="mt-6 text-center">
                <Button onClick={() => router.push('/')}>Go to Homepage</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">Thank You for Your Donation!</CardTitle>
            <p className="text-muted-foreground mt-2">
              Your contribution makes a real difference
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg mb-4">Payment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-lg">৳{paymentData?.amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transaction ID</p>
                  <p className="font-mono text-sm">{paymentData?.transaction_id}</p>
                </div>
                {paymentData?.payment_method && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-semibold capitalize">{paymentData.payment_method}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize text-green-600">
                    {paymentData?.status}
                  </p>
                </div>
              </div>
            </div>

            {pledgeData?.message && (
              <div className="border-l-4 border-primary pl-4">
                <p className="text-sm text-muted-foreground mb-1">Your Message</p>
                <p className="italic">{pledgeData.message}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                onClick={() => router.push(`/campaigns/${pledgeData?.campaign_id}`)}
              >
                View Campaign
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/campaigns">Browse More Campaigns</Link>
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Email confirmation sent:</span> A receipt has
                been sent to your registered email address.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="container mx-auto px-4 py-12">
            <Card className="max-w-md mx-auto">
              <CardContent className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
