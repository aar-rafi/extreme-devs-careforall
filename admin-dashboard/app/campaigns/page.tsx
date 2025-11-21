'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminApi } from '@/lib/api/admin';
import { formatDistanceToNow } from 'date-fns';

export default function AdminCampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Don't redirect while still loading auth state
    if (isAuthLoading) return;

    if (!isAuthenticated || user?.role !== 'ADMIN') {
      router.push('/login');
    }
  }, [isAuthenticated, user, router, isAuthLoading]);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['admin-campaigns', filter],
    queryFn: () =>
      adminApi.getCampaigns({
        status: filter !== 'all' ? filter : undefined,
      }),
    enabled: isAuthenticated && user?.role === 'ADMIN',
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateCampaignStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  // Show loading while auth is being initialized
  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-2xl font-bold text-primary">
                CareForAll Admin
              </Link>
            </div>
            <Link href="/">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Campaign Management</h1>
          <p className="text-muted-foreground">Review and moderate all campaigns</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'draft' ? 'default' : 'outline'}
            onClick={() => setFilter('draft')}
          >
            Drafts
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            onClick={() => setFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            onClick={() => setFilter('completed')}
          >
            Completed
          </Button>
        </div>

        {/* Campaigns List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : campaigns?.data && campaigns.data.length > 0 ? (
          <div className="space-y-4">
            {campaigns.data.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="py-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{campaign.title}</h3>
                        <Badge variant={campaign.status === 'active' ? 'default' : 'outline'}>
                          {campaign.status}
                        </Badge>
                        <Badge variant="secondary">{campaign.campaign_type}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-4">
                        <div>
                          <span className="font-medium">Goal:</span> ৳
                          {campaign.goal_amount.toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Raised:</span> ৳
                          {campaign.current_amount.toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Organizer:</span>{' '}
                          {campaign.organizer_email}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {formatDistanceToNow(new Date(campaign.created_at))} ago
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {campaign.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              updateStatusMutation.mutate({ id: campaign.id, status: 'active' })
                            }
                            disabled={updateStatusMutation.isPending}
                          >
                            Approve & Activate
                          </Button>
                        )}
                        {campaign.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: campaign.id,
                                  status: 'completed',
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              Mark Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: campaign.id,
                                  status: 'cancelled',
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`http://localhost:4000/campaigns/${campaign.id}`} target="_blank">
                            View Public Page
                          </a>
                        </Button>
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
              <p className="text-muted-foreground">No campaigns found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
