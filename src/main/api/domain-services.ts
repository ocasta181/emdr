import { newSessionRepository } from "../internal/domain/session/repository.js";
import { SessionService } from "../internal/domain/session/service.js";
import { newSettingRepository } from "../internal/domain/setting/repository.js";
import { SettingService } from "../internal/domain/setting/service.js";
import { newStimulationSetRepository } from "../internal/domain/stimulation-set/repository.js";
import { StimulationSetService } from "../internal/domain/stimulation-set/service.js";
import { newTargetRepository } from "../internal/domain/target/repository.js";
import { TargetService } from "../internal/domain/target/service.js";
import type { CreateDomainServices } from "./domain-services.types.js";

export const createDomainServices: CreateDomainServices = (db) => {
  const sessionLookup = new SessionService(newSessionRepository(db));
  const stimulationSets = new StimulationSetService(newStimulationSetRepository(db), sessionLookup);

  return {
    targets: new TargetService(newTargetRepository(db)),
    sessions: new SessionService(newSessionRepository(db), stimulationSets),
    settings: new SettingService(newSettingRepository(db)),
    stimulationSets
  };
};
