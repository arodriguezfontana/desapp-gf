import { Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { AuthService } from '../../services/auth/auth.service';
import { ApiKeyService } from '../../services/api-key/api-key.service';
import { IssueApiKeyResponseDto } from './dto/issue-api-key-response.dto';

@ApiTags('auth')
@Controller('auth/api-key')
export class ApiKeyController {
  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly auth: AuthService,
  ) {}

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
    // El controller no toca repositorios: pide el User emisor al Service de auth
    // (constitución I) y lo pasa al Service de ApiKey, que copia su rol (spec 008, R2).
    const user = await this.auth.getById(userId);
    const { apiKey, rawApiKey } = await this.apiKeys.issueApiKey(user);
    return IssueApiKeyResponseDto.fromDomain(apiKey, rawApiKey);
  }
}
