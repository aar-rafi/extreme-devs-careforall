'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Navbar } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { campaignsApi, CreateCampaignData } from '@/lib/api/campaigns';
import { useAuthStore } from '@/stores/useAuthStore';
import { Navbar as NavbarComponent } from '@/components/navbar';
import { Button } from '@/components/ui/button';

const campaignSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  details: z.string().optional(),
  campaign_type: z.enum(['medical', 'education', 'emergency', 'long_term']),
  goal_amount: z.number().min(100, 'Goal amount must be at least ৳100'),
  end_date: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

export default function CreateCampaignPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/campaigns/create');
    }
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaign_type: 'medical',
    },
  });

  const campaignType = watch('campaign_type');

  const createMutation = useMutation({
    mutationFn: (data: CreateCampaignData) => campaignsApi.create(data),
    onSuccess: (response) => {
      router.push(`/campaigns/${response.data.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create campaign');
    },
  });

  const onSubmit = (data: CampaignFormData) => {
    setError('');
    createMutation.mutate({
      ...data,
      end_date: data.end_date || undefined,
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarComponent />

      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Start a Campaign</CardTitle>
              <CardDescription>
                Share your story and raise funds for what matters to you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title">Campaign Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Help Save My Father's Life"
                    {...register('title')}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="campaign_type">Campaign Type *</Label>
                  <Select
                    value={campaignType}
                    onValueChange={(value) =>
                      setValue('campaign_type', value as CampaignFormData['campaign_type'])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="long_term">Long Term</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.campaign_type && (
                    <p className="text-sm text-red-500">{errors.campaign_type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Short Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Briefly describe your campaign (50-200 characters)"
                    rows={3}
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details">Full Story (Optional)</Label>
                  <Textarea
                    id="details"
                    placeholder="Share the full story of your campaign. Include important details that will help donors understand and connect with your cause."
                    rows={8}
                    {...register('details')}
                  />
                  {errors.details && (
                    <p className="text-sm text-red-500">{errors.details.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal_amount">Fundraising Goal (৳) *</Label>
                  <Input
                    id="goal_amount"
                    type="number"
                    placeholder="10000"
                    {...register('goal_amount', { valueAsNumber: true })}
                  />
                  {errors.goal_amount && (
                    <p className="text-sm text-red-500">{errors.goal_amount.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Set a realistic goal that you need to raise
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    {...register('end_date')}
                  />
                  {errors.end_date && (
                    <p className="text-sm text-red-500">{errors.end_date.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Leave blank if you don't have a specific deadline
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h4 className="font-semibold mb-2">Before you submit:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Make sure all information is accurate and truthful</li>
                    <li>• Your campaign will be reviewed before going live</li>
                    <li>• You can edit your campaign details after submission</li>
                    <li>• Funds will be transferred after verification</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
