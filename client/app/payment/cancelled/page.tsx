'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pledgesApi } from '@/lib/api/pledges';

function PaymentCancelledContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pledgeId = searchParams.get('pledge');

  const [loading, setLoading] = useState(true);
  const [pledgeData, setPledgeData] = useState<any>(null);

  useEffect(() => {
    if (pledgeId) {
      loadPledgeData(pledgeId);
    } else {
      setLoading(false);
    }
  }, [pledgeId]);

  const loadPledgeData = async (pledgeId: string) => {
    try {
      const pledgeResponse = await pledgesApi.getById(pledgeId);
      setPledgeData(pledgeResponse.data);
    } catch (err) {
      console.error('Failed to load pledge data:', err);
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
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
            <p className="text-muted-foreground mt-2">
              You've cancelled the payment process
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading details...</p>
              </div>
            ) : (
              <>
                {pledgeData && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-lg mb-3">Your Pledge</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-semibold">৳{pledgeData.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="text-orange-600 capitalize">{pledgeData.status}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-semibold">What happened?</h3>
                  <p className="text-muted-foreground">
                    You chose to cancel the payment process. No charges were made to your
                    account.
                  </p>
                  <p className="text-muted-foreground">
                    Your pledge is still saved. You can complete the payment anytime to support
                    this campaign.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1" onClick={handleRetry}>
                    Complete Payment
                  </Button>
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href="/campaigns">Browse Other Campaigns</Link>
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-blue-900 mb-2">
                    Questions?
                  </h4>
                  <p className="text-sm text-blue-800 mb-2">
                    If you experienced any issues or need assistance, please contact us:
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

export default function PaymentCancelledPage() {
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
      <PaymentCancelledContent />
    </Suspense>
  );
}
