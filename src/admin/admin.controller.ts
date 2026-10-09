import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import type { UsageSeriesPointDto, UsageSummaryDto } from './dto/usage.dto';
import { UsageSeriesQuery } from './dto/usage-series.query';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** Totals and every account's deliveries today / this week / this month. */
  @Get('usage')
  usage(): Promise<UsageSummaryDto> {
    return this.adminService.usageSummary();
  }

  @Get('usage/series')
  series(@Query() query: UsageSeriesQuery): Promise<UsageSeriesPointDto[]> {
    return this.adminService.usageSeries(query.unit, query.userId);
  }
}
