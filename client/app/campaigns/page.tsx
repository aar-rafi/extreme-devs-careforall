'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { campaignsApi } from '@/lib/api/campaigns';
import { Campaign } from '@/types';

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = (campaign.current_amount / campaign.goal_amount) * 100;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <Badge variant="secondary">{campaign.campaign_type}</Badge>
          <Badge variant={campaign.status === 'active' ? 'default' : 'outline'}>
            {campaign.status}
          </Badge>
        </div>
        <CardTitle className="line-clamp-2">{campaign.title}</CardTitle>
        <CardDescription className="line-clamp-3">{campaign.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">৳{campaign.current_amount.toLocaleString()}</span>
            <span className="text-muted-foreground">of ৳{campaign.goal_amount.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/campaigns/${campaign.id}`}>View Campaign</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function CampaignsPage() {
  const [search, setSearch] = useState('');
  const [campaignType, setCampaignType] = useState<string>('all');
  const [status, setStatus] = useState<string>('active');

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', { campaignType, status, search }],
    queryFn: () =>
      campaignsApi.list({
        campaign_type: campaignType !== 'all' ? campaignType : undefined,
        status: status !== 'all' ? status : undefined,
        search: search || undefined,
      }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">All Campaigns</h1>
            <p className="text-muted-foreground">Discover and support campaigns that matter</p>
          </div>

          {/* Filters */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger>
                <SelectValue placeholder="Campaign Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="long_term">Long Term</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campaigns Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
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
          ) : data?.data && data.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.data.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No campaigns found matching your criteria</p>
                <Button className="mt-4" asChild>
                  <Link href="/campaigns/create">Create a Campaign</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
