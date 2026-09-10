import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChallengesService } from './challenges.service';
import { AcceptChallengeDto, CreateChallengeDto } from './dto/challenge.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get('clubs/:id/challenge-eligibility')
  getEligibility(@Param('id') clubId: string, @CurrentUser() user: { sub: string }) {
    return this.challengesService.getEligibility(clubId, user.sub);
  }

  @Get('clubs/:id/challengeable-clubs')
  listChallengeable(@Param('id') clubId: string, @CurrentUser() user: { sub: string }) {
    return this.challengesService.listChallengeableClubs(clubId, user.sub);
  }

  @Post('challenges')
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateChallengeDto) {
    return this.challengesService.create(user.sub, dto);
  }

  @Get('challenges/me')
  listMine(@CurrentUser() user: { sub: string }) {
    return this.challengesService.listMine(user.sub);
  }

  @Get('challenges/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.challengesService.getChallenge(id, user.sub);
  }

  @Post('challenges/:id/accept')
  accept(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: AcceptChallengeDto,
  ) {
    return this.challengesService.accept(id, user.sub, dto);
  }

  @Post('challenges/:id/decline')
  decline(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.challengesService.decline(id, user.sub);
  }

  @Get('clubs/:id/partner-candidates')
  partnerCandidates(
    @Param('id') clubId: string,
    @CurrentUser() user: { sub: string },
    @Query('for') _for?: string,
  ) {
    return this.challengesService.getEligibility(clubId, user.sub).then((e) => ({
      partners: e.partners,
      preferredPartnerSide: e.preferredPartnerSide,
      myPosition: e.myPosition,
    }));
  }
}
