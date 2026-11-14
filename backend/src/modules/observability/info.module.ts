import { Module } from '@nestjs/common';
import { InfoController } from '../../controllers/observability/info.controller';
import { InfoService } from '../../services/observability/info.service';
import { readPackageManifest, resolveBuildInfo } from '../../shared/observability/info/build-info';
import { RuntimeModule } from '../runtime/runtime.module';
import { BUILD_INFO } from './info.constants';

/** `GET /info`: información del build y del proceso (equivalente a `/actuator/info`). */
@Module({
  imports: [RuntimeModule],
  controllers: [InfoController],
  providers: [
    InfoService,
    { provide: BUILD_INFO, useFactory: () => resolveBuildInfo(process.env, readPackageManifest()) },
  ],
})
export class InfoModule {}
