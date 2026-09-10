import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Exime al endpoint del JwtAuthGuard global. Solo el alta y el login deben usarlo
 * (mas los endpoints tecnicos como health).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
