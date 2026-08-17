import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RemediationStepDto {
  @Expose()
  @ApiProperty({ type: String })
  action!: string;

  @Expose()
  @ApiProperty({ type: String })
  rationale!: string;

  @Expose()
  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  riskLevel!: 'low' | 'medium' | 'high';
}
