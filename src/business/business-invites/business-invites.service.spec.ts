import { Test, TestingModule } from '@nestjs/testing';
import { BusinessInvitesService } from './business-invites.service';

describe('BusinessInvitesService', () => {
  let service: BusinessInvitesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessInvitesService],
    }).compile();

    service = module.get<BusinessInvitesService>(BusinessInvitesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
