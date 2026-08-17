import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RootCauseHypothesisDto {
  @Expose()
  @ApiProperty({ type: String })
  rootCause!: string;

  @Expose()
  @ApiProperty({ type: Number, minimum: 0, maximum: 1 })
  confidence!: number;

  @Expose()
  @ApiProperty({ type: String })
  reasoning!: string;
}
