import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class InvestigateIncidentParamsDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  incidentId!: string;
}
