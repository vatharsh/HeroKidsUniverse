import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/** Lets a signed-in parent whose email isn't verified yet reach this route (verification, profile, logout). */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
