import { Room, type ClosedWhy, type RoomStatus } from '$lib/classroom/api';
import type { CarView, RaceInfo } from './api';

/**
 * One race, live (Puzzle Racer): the race (its phase, start and end, puzzles), every car and the connection, which
 * comes back by itself after a drop with the race as it is. `now()` is the race's clock, so everyone's lights and
 * timer agree.
 */
export class Race {
  info = $state<RaceInfo | undefined>();
  cars = $state<CarView[]>([]);
  me = $state('');
  status = $state<RoomStatus>('connecting');
  /** Why it can't be joined (started without me, full, gone). */
  error = $state('');
  /** The final order, when the flag falls. */
  final = $state<CarView[] | undefined>();
  private room: Room;

  constructor(public id: string) {
    this.room = new Room(
      id,
      (m) => this.on(m),
      (s: RoomStatus, why?: ClosedWhy) => {
        this.status = s;
        if (s === 'closed' && why === 'refused' && !this.info) this.error = 'This race has started without you, is full, or is over. Join the next one!';
      },
      false,
      'race',
    );
  }

  private on(m: any) {
    switch (m.t) {
      case 'state':
        this.info = m.race;
        this.cars = m.cars;
        this.me = m.me;
        if (m.race.phase === 'over') this.final = m.cars;
        return;
      case 'cars':
        this.cars = m.cars;
        return;
      case 'phase':
        if (this.info) this.info = { ...this.info, phase: m.phase, startAt: m.startAt, endAt: m.endAt };
        return;
      case 'over':
        if (this.info) this.info = { ...this.info, phase: 'over' };
        this.cars = m.cars;
        this.final = m.cars;
        return;
    }
  }

  now() {
    return this.room.now();
  }
  get mine() {
    return this.cars.find((c) => c.uid === this.me);
  }
  /** My place now (1 = leading). */
  get rank() {
    return this.cars.findIndex((c) => c.uid === this.me) + 1;
  }
  /** The race's maker starts a race with friends. */
  start() {
    this.room.send({ t: 'start' });
  }
  /** My answer to puzzle `i`. */
  solve(i: number, ok: boolean) {
    this.room.send({ t: 'solve', i, ok });
  }
  close() {
    this.room.close();
  }
}
