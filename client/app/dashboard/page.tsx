'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { campaignsApi } from '@/lib/api/campaigns';
import { donationsApi } from '@/lib/api/donations';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/dashboard');
    }
  }, [isAuthenticated, router]);

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['user-campaigns'],
    queryFn: () => campaignsApi.list({ creator_id: user?.id }),
    enabled: !!user?.id,
  });

  const { data: donationsData, isLoading: donationsLoading } = useQuery({
    queryKey: ['user-donations'],
    queryFn: () => donationsApi.list({ donor_id: user?.id }),
    enabled: !!user?.id,
  });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">My Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your campaigns and view your donation history
            </p>
          </div>

          <Tabs defaultValue="campaigns" className="space-y-6">
            <TabsList>
              <TabsTrigger value="campaigns">My Campaigns</TabsTrigger>
              <TabsTrigger value="donations">My Donations</TabsTrigger>
            </TabsList>

            {/* My Campaigns Tab */}
            <TabsContent value="campaigns" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">My Campaigns</h2>
                <Button asChild>
                  <Link href="/campaigns/create">Create New Campaign</Link>
                </Button>
              </div>

              {campaignsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/4" />
                        <div className="h-6 bg-gray-200 rounded" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                      </CardHeader>
                      <CardContent>
                        <div className="h-2 bg-gray-200 rounded w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : campaignsData?.data && campaignsData.data.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {campaignsData.data.map((campaign) => {
                    const progress = (campaign.current_amount / campaign.goal_amount) * 100;
                    return (
                      <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <Badge variant="secondary">{campaign.campaign_type}</Badge>
                            <Badge variant={campaign.status === 'active' ? 'default' : 'outline'}>
                              {campaign.status}
                            </Badge>
                          </div>
                          <CardTitle className="line-clamp-2">{campaign.title}</CardTitle>
                          <CardDescription>
                            Created {formatDistanceToNow(new Date(campaign.created_at))} ago
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-semibold">
                                ৳{campaign.current_amount.toLocaleString()}
                              </span>
                              <span className="text-muted-foreground">
                                of ৳{campaign.goal_amount.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {Math.round(progress)}% funded
                            </p>
                          </div>
                          <Button asChild className="w-full" variant="outline">
                            <Link href={`/campaigns/${campaign.id}`}>View Campaign</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      You haven't created any campaigns yet
                    </p>
                    <Button asChild>
                      <Link href="/campaigns/create">Create Your First Campaign</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* My Donations Tab */}
            <TabsContent value="donations" className="space-y-6">
              <h2 className="text-2xl font-bold">My Donations</h2>

              {donationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="py-6">
                        <div className="flex justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-gray-200 rounded w-1/3" />
                            <div className="h-3 bg-gray-200 rounded w-1/4" />
                          </div>
                          <div className="h-6 bg-gray-200 rounded w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : donationsData?.data && donationsData.data.length > 0 ? (
                <div className="space-y-4">
                  {donationsData.data.map((donation) => (
                    <Card key={donation.id}>
                      <CardContent className="py-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">
                                Campaign #{donation.campaign_id.slice(0, 8)}
                              </h3>
                              <Badge
                                variant={
                                  donation.payment_status === 'completed'
                                    ? 'default'
                                    : donation.payment_status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {donation.payment_status}
                              </Badge>
                            </div>
                            {donation.message && (
                              <p className="text-sm text-muted-foreground mb-2">
                                "{donation.message}"
                              </p>
                            )}
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(donation.created_at))} ago
                              </span>
                              <span>via {donation.payment_method}</span>
                              {donation.is_anonymous && <span>• Anonymous</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              ৳{donation.amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      You haven't made any donations yet
                    </p>
                    <Button asChild>
                      <Link href="/campaigns">Browse Campaigns</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
