import { EventsService } from '../src/events/events.service';

export function createEventsService(
  ...dependencies: ConstructorParameters<typeof EventsService>
): EventsService {
  return new EventsService(...dependencies);
}
