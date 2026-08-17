import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { RemediationStepDto } from './remediation-step.dto';
import { RootCauseHypothesisDto } from './root-cause-hypothesis.dto';

export class InvestigationResultDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  incidentId!: string;

  @Expose()
  @ApiProperty({ type: String })
  logFindings!: string;

  @Expose()
  @ApiProperty({ type: String })
  runbookFindings!: string;

  @Expose()
  @Type(() => RootCauseHypothesisDto)
  @ApiProperty({ type: [RootCauseHypothesisDto] })
  hypotheses!: RootCauseHypothesisDto[];

  @Expose()
  @Type(() => RemediationStepDto)
  @ApiProperty({ type: [RemediationStepDto] })
  remediationSteps!: RemediationStepDto[];
}
