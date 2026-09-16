import { ApiProperty } from '@nestjs/swagger';
import { ApiKey } from '../../../domain/api-key/api-key';
import { RawApiKey } from '../../../domain/api-key/raw-api-key';

export class IssueApiKeyResponseDto {
  @ApiProperty({ example: '3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b' })
  id: string;

  @ApiProperty({
    example:
      'pmk_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd',
    description:
      'Valor en texto plano de la ApiKey. Se muestra una única vez: el sistema no la vuelve a exponer.',
  })
  apiKey: string;

  @ApiProperty({ example: '2026-09-15T14:03:22.000Z' })
  createdAt: Date;

  private constructor(id: string, apiKey: string, createdAt: Date) {
    this.id = id;
    this.apiKey = apiKey;
    this.createdAt = createdAt;
  }

  static fromDomain(
    apiKey: ApiKey,
    rawApiKey: RawApiKey,
  ): IssueApiKeyResponseDto {
    return new IssueApiKeyResponseDto(
      apiKey.id,
      rawApiKey.toPlainText(),
      apiKey.createdAt,
    );
  }
}
