import type { ReactNode } from 'react';
import type { AccountCraftRequestResourcesOption, AccountInventoryResourceEntry } from '../../services/authService';
import type { Blueprint, Resource } from '../../types';

export interface SharedOfferOwner {
  handle: string;
  displayName: string;
  imageUrl?: string | null;
  rank?: string | null;
}

export interface SharedBlueprintOfferCardProps {
  blueprint: Blueprint;
  owner: SharedOfferOwner;
  contextLabel?: string;
  requestState?: 'available' | 'pending' | 'accepted' | 'self' | 'unavailable';
  busy?: boolean;
  onRequest?: () => void;
  onOpenBlueprint?: () => void;
  onManageSharing?: () => void;
  onViewRequests?: () => void;
  extraAction?: ReactNode;
}

export interface SharedResourceOfferCardProps {
  entry: AccountInventoryResourceEntry;
  resource?: Resource | null;
  owner: SharedOfferOwner;
  contextLabel?: string;
  onOpenResource?: () => void;
  onContact?: () => void;
  contactLabel?: string;
  extraAction?: ReactNode;
}

export interface CraftRequestDraft {
  comment: string;
  resourcesOption: AccountCraftRequestResourcesOption;
}

export interface CraftRequestDialogProps {
  open: boolean;
  source?: 'organization' | 'community';
  blueprintName: string;
  owner: SharedOfferOwner;
  contextLabel?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (draft: CraftRequestDraft) => void;
}
