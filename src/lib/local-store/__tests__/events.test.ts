import { createStoreEvents } from "../events";
import { flushStoreEvents } from "../test-support/test-store";

describe("createStoreEvents", () => {
  it("calls a listener once with every table emitted in the same tick", async () => {
    const events = createStoreEvents();
    const listener = jest.fn();
    events.subscribe(["vacations", "groups"], listener);

    events.emit(["vacations"]);
    events.emit(["groups"]);
    events.emit(["vacations"]);
    expect(listener).not.toHaveBeenCalled();

    await flushStoreEvents();

    expect(listener).toHaveBeenCalledTimes(1);
    expect([...listener.mock.calls[0][0]]).toEqual(["vacations", "groups"]);
  });

  it("leaves a listener whose tables were not emitted alone", async () => {
    const events = createStoreEvents();
    const listener = jest.fn();
    events.subscribe(["vacations"], listener);

    events.emit(["bankHolidays", "users"]);
    await flushStoreEvents();

    expect(listener).not.toHaveBeenCalled();
  });

  it("calls a listener again on the next tick", async () => {
    const events = createStoreEvents();
    const listener = jest.fn();
    events.subscribe(["vacations"], listener);

    events.emit(["vacations"]);
    await flushStoreEvents();
    events.emit(["vacations"]);
    await flushStoreEvents();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stops calling a listener that unsubscribed", async () => {
    const events = createStoreEvents();
    const listener = jest.fn();
    const unsubscribe = events.subscribe(["vacations"], listener);

    unsubscribe();
    events.emit(["vacations"]);
    await flushStoreEvents();

    expect(listener).not.toHaveBeenCalled();
  });

  it("calls every listener the emitted tables reach", async () => {
    const events = createStoreEvents();
    const onVacations = jest.fn();
    const onSyncState = jest.fn();
    events.subscribe(["vacations"], onVacations);
    events.subscribe(["syncState"], onSyncState);

    events.emit(["vacations", "syncState"]);
    await flushStoreEvents();

    expect(onVacations).toHaveBeenCalledTimes(1);
    expect(onSyncState).toHaveBeenCalledTimes(1);
  });
});
