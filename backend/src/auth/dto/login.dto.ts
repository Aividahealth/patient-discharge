import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * SECURITY: Login request DTO with validation
 * Prevents injection attacks and malformed requests
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Tenant ID is required' })
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Tenant ID must contain only alphanumeric characters, hyphens, and underscores',
  })
  tenantId: string;

  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(50, { message: 'Username must not exceed 50 characters' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(1)
  @MaxLength(1000) // Allow long passwords but prevent abuse
  password: string;
}
