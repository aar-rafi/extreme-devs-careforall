'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list({ status: 'active', limit: 6 }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-primary text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">Support Causes That Matter</h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of donors making a difference through our secure, transparent fundraising
            platform
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/campaigns">Browse Campaigns</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white hover:text-primary" asChild>
              <Link href="/campaigns/create">Start a Campaign</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Campaigns */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Active Campaigns</h2>
              <p className="text-muted-foreground mt-2">Help bring these campaigns to life</p>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/campaigns">View All</Link>
            </Button>
          </div>

          {isLoading ? (
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
          ) : data?.data && data.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.data.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No active campaigns at the moment</p>
                <Button className="mt-4" asChild>
                  <Link href="/campaigns/create">Be the first to start one</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">1000+</div>
              <div className="text-muted-foreground">Campaigns Funded</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">৳10M+</div>
              <div className="text-muted-foreground">Total Raised</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">50K+</div>
              <div className="text-muted-foreground">Happy Donors</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
