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

function PaymentFailedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pledgeId = searchParams.get('pledge');

  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [pledgeData, setPledgeData] = useState<any>(null);

  useEffect(() => {
    if (pledgeId) {
      loadPaymentData(pledgeId);
    } else {
      setLoading(false);
    }
  }, [pledgeId]);

  const loadPaymentData = async (pledgeId: string) => {
    try {
      const [paymentResponse, pledgeResponse] = await Promise.all([
        paymentsApi.getByPledgeId(pledgeId),
        pledgesApi.getById(pledgeId),
      ]);

      setPaymentData(paymentResponse.data);
      setPledgeData(pledgeResponse.data);
    } catch (err) {
      console.error('Failed to load payment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (pledgeData?.campaign_id) {
      router.push(`/campaigns/${pledgeData.campaign_id}`);
    } else {
      router.push('/campaigns');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">Payment Failed</CardTitle>
            <p className="text-muted-foreground mt-2">
              We're sorry, but your payment could not be processed
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentData?.error_message && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p className="font-semibold mb-1">Error Details:</p>
                  <p>{paymentData.error_message}</p>
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading payment details...</p>
              </div>
            ) : (
              <>
                {paymentData && (
                  <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                    <h3 className="font-semibold text-lg mb-4">Transaction Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {paymentData.transaction_id && (
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Transaction ID</p>
                          <p className="font-mono text-sm">{paymentData.transaction_id}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold text-lg">৳{paymentData.amount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="font-semibold capitalize text-red-600">
                          {paymentData.status}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-semibold">What happened?</h3>
                  <p className="text-muted-foreground">
                    Your payment could not be completed. Common reasons include:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Insufficient funds in your account</li>
                    <li>Payment cancelled by user</li>
                    <li>Card declined by bank</li>
                    <li>Network or connectivity issues</li>
                    <li>Invalid payment details</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1" onClick={handleRetry}>
                    Try Again
                  </Button>
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href="/campaigns">Browse Campaigns</Link>
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-blue-900 mb-2">
                    Need Help?
                  </h4>
                  <p className="text-sm text-blue-800 mb-2">
                    If you continue to experience issues, please contact our support team:
                  </p>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>
                      <span className="font-semibold">Email:</span> support@careforall.com
                    </p>
                    <p>
                      <span className="font-semibold">Phone:</span> +880 1234-567890
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="container mx-auto px-4 py-12">
            <Card className="max-w-md mx-auto">
              <CardContent className="py-12 text-center">
                <p>Loading...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}
