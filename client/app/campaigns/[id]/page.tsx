'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { campaignsApi } from '@/lib/api/campaigns';
import { donationsApi, CreateDonationData } from '@/lib/api/donations';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDistanceToNow } from 'date-fns';

const donationSchema = z.object({
  amount: z.number().min(10, 'Minimum donation is ৳10'),
  payment_method: z.string().min(1, 'Payment method is required'),
  is_anonymous: z.boolean().default(false),
  message: z.string().optional(),
});

type DonationFormData = z.infer<typeof donationSchema>;

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const campaignId = params.id as string;

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignsApi.getById(campaignId),
  });

  const { data: donationsData, isLoading: donationsLoading } = useQuery({
    queryKey: ['donations', campaignId],
    queryFn: () => donationsApi.list({ campaign_id: campaignId, limit: 10 }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<DonationFormData>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      payment_method: 'bkash',
      is_anonymous: false,
    },
  });

  const donationMutation = useMutation({
    mutationFn: (data: CreateDonationData) => donationsApi.create(data),
    onSuccess: async (response) => {
      setSuccess('Donation created successfully! Redirecting to payment...');
      reset();
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['donations', campaignId] });

      // Initialize payment
      if (response.data.id) {
        const paymentResponse = await donationsApi.initializePayment(response.data.id);
        if (paymentResponse.success && paymentResponse.data.payment_url) {
          window.location.href = paymentResponse.data.payment_url;
        }
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create donation');
    },
  });

  const onSubmit = (data: DonationFormData) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/campaigns/${campaignId}`);
      return;
    }

    setError('');
    setSuccess('');
    donationMutation.mutate({
      campaign_id: campaignId,
      amount: data.amount,
      payment_method: data.payment_method,
      is_anonymous: data.is_anonymous,
      message: data.message,
    });
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaignData?.data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <Alert variant="destructive">
            <AlertDescription>Campaign not found</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const campaign = campaignData.data;
  const progress = (campaign.current_amount / campaign.goal_amount) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <Badge variant="secondary">{campaign.campaign_type}</Badge>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'outline'}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-3xl">{campaign.title}</CardTitle>
                  <CardDescription className="text-base">
                    Created {formatDistanceToNow(new Date(campaign.created_at))} ago
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>৳{campaign.current_amount.toLocaleString()}</span>
                      <span className="text-muted-foreground">
                        of ৳{campaign.goal_amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-primary h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {Math.round(progress)}% funded
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="text-xl font-semibold mb-3">About this campaign</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{campaign.description}</p>
                  </div>

                  {/* Campaign Details */}
                  {campaign.details && (
                    <div>
                      <h3 className="text-xl font-semibold mb-3">Campaign Details</h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">{campaign.details}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Donations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Donations</CardTitle>
                </CardHeader>
                <CardContent>
                  {donationsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse flex justify-between">
                          <div className="h-4 bg-gray-200 rounded w-1/4" />
                          <div className="h-4 bg-gray-200 rounded w-1/6" />
                        </div>
                      ))}
                    </div>
                  ) : donationsData?.data && donationsData.data.length > 0 ? (
                    <div className="space-y-4">
                      {donationsData.data.map((donation) => (
                        <div
                          key={donation.id}
                          className="flex justify-between items-start border-b pb-3 last:border-0"
                        >
                          <div>
                            <p className="font-semibold">
                              {donation.is_anonymous
                                ? 'Anonymous'
                                : `${donation.donor?.first_name || ''} ${donation.donor?.last_name || ''}`.trim() ||
                                  'Donor'}
                            </p>
                            {donation.message && (
                              <p className="text-sm text-muted-foreground mt-1">{donation.message}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(donation.created_at))} ago
                            </p>
                          </div>
                          <Badge variant="outline">৳{donation.amount.toLocaleString()}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No donations yet. Be the first to donate!
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Donation Form */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Make a Donation</CardTitle>
                  <CardDescription>Support this campaign</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    {success && (
                      <Alert>
                        <AlertDescription>{success}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (৳)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="100"
                        {...register('amount', { valueAsNumber: true })}
                      />
                      {errors.amount && (
                        <p className="text-sm text-red-500">{errors.amount.message}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {[100, 500, 1000].map((amount) => (
                          <Button
                            key={amount}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setValue('amount', amount)}
                          >
                            ৳{amount}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment_method">Payment Method</Label>
                      <select
                        id="payment_method"
                        className="w-full px-3 py-2 border rounded-md"
                        {...register('payment_method')}
                      >
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="rocket">Rocket</option>
                        <option value="card">Credit/Debit Card</option>
                      </select>
                      {errors.payment_method && (
                        <p className="text-sm text-red-500">{errors.payment_method.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message (Optional)</Label>
                      <Textarea
                        id="message"
                        placeholder="Share why you're supporting this campaign..."
                        {...register('message')}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_anonymous"
                        {...register('is_anonymous')}
                        className="rounded"
                      />
                      <Label htmlFor="is_anonymous" className="text-sm font-normal">
                        Donate anonymously
                      </Label>
                    </div>

                    <Button type="submit" className="w-full" disabled={donationMutation.isPending}>
                      {donationMutation.isPending ? 'Processing...' : 'Donate Now'}
                    </Button>

                    {!isAuthenticated && (
                      <p className="text-xs text-center text-muted-foreground">
                        You'll be asked to login before completing the donation
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
