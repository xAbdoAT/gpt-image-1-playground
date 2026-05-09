// Hook to manage providers and models
import * as React from 'react';
import { getAllModelsGrouped, getEnabledProviders } from '@/providers/registry';

export type ProviderGroup = {
  id: string;
  name: string;
  models: {
    id: string;
    name: string;
  }[];
};

export const useProviders = () => {
  const [providerGroups, setProviderGroups] = React.useState<ProviderGroup[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadProviders = () => {
      try {
        // Get all enabled providers
        const providers = getEnabledProviders();
        
        // Get all models grouped by provider
        const groupedModels = getAllModelsGrouped();
        
        // Create provider groups with their models
        const groups: ProviderGroup[] = providers.map(provider => ({
          id: provider.id,
          name: provider.name,
          models: groupedModels[provider.id]?.map(model => ({
            id: model.id,
            name: model.name
          })) || []
        })).filter(group => group.models.length > 0); // Only show providers with models
        
        setProviderGroups(groups);
        setLoading(false);
      } catch (error) {
        console.error('Error loading providers:', error);
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  return {
    providerGroups,
    loading
  };
};