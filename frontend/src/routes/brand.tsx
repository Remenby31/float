import { createFileRoute } from '@tanstack/react-router';

import { BrandPage } from '@/features/brand/components/BrandPage';

export const Route = createFileRoute('/brand')({ component: BrandPage });
