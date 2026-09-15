import { Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../guards/current-user.decorator';
import { ApiKeyService } from '../services/api-key.service';
import { IssueApiKeyResponseDto } from './dto/api-key/issue-api-key-response.dto';

@ApiTags('auth')
@Controller('auth/api-key')
export class ApiKeyController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Emite una nueva ApiKey para el usuario autenticado, invalidando la anterior si existía',
  })
  @ApiResponse({ status: 201, type: IssueApiKeyResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async issue(@CurrentUser() userId: string): Promise<IssueApiKeyResponseDto> {
    const { apiKey, rawApiKey } = await this.apiKeys.issueApiKey(userId);
    return IssueApiKeyResponseDto.fromDomain(apiKey, rawApiKey);
  }
}
