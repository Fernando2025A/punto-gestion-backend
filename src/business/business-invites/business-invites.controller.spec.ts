import { Test, TestingModule } from '@nestjs/testing';
import { BusinessInvitesController } from './business-invites.controller';
import { BusinessInvitesService } from './business-invites.service';

describe('BusinessInvitesController', () => {
  let controller: BusinessInvitesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessInvitesController],
      providers: [BusinessInvitesService],
    }).compile();

    controller = module.get<BusinessInvitesController>(BusinessInvitesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
