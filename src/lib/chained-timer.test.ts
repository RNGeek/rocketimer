import { ChainedTimer } from './chained-timer';
import { TestableTimeController } from './timer/time-controller';
import { TestableTickController } from './timer/tick-controller';

function createTimer(lapDurations: number[], offset: number) {
  const timeController = new TestableTimeController();
  const tickController = new TestableTickController(timeController);
  const timer = new ChainedTimer(lapDurations, offset, timeController, tickController);
  const listener = jest.fn();
  timer.addListener('tick', listener);
  return { timeController, tickController, timer, listener };
}

function createStartedTimer(lapDurations: number[], offset: number) {
  const { timeController, tickController, timer, listener } = createTimer(lapDurations, offset);
  timer.start();
  return { timeController, tickController, timer, listener };
}

function createElapsedTimer(lapDurations: number[], offset: number, elapsed: number) {
  const { timeController, tickController, timer, listener } = createStartedTimer(lapDurations, offset);
  timeController.advanceTimeBy(elapsed);
  tickController.advanceTick();
  return { timeController, tickController, timer, listener };
}

describe('Timer', () => {
  describe('#constructor', () => {
    test('インスタンスが作成できる', () => {
      const { timer } = createTimer([1000, 2000, 3000], 0);
      expect(timer.status).toBe('stopped');
      expect(timer.currentLapRemain).toBe(1000);
      expect(timer.currentLapIndex).toBe(0);
      expect(timer.offset).toBe(0);
    });
    test('ラップ数が 0 のタイマーのインスタンスは作成できない', () => {
      expect(() => {
        createTimer([], 0);
      }).toThrow();
    });
    test('オフセットを指定できる', () => {
      const { timer } = createTimer([1000, 2000, 3000], 500);
      expect(timer.status).toBe('stopped');
      expect(timer.currentLapRemain).toBe(500);
      expect(timer.currentLapIndex).toBe(0);
      expect(timer.offset).toBe(500);
  });
    test('負のオフセットを指定できる', () => {
      const { timer } = createTimer([1000, 2000, 3000], -500);
      expect(timer.status).toBe('stopped');
      expect(timer.currentLapRemain).toBe(1500);
      expect(timer.currentLapIndex).toBe(0);
      expect(timer.offset).toBe(-500);
    });
  });

  describe('初期状態', () => {
    let context: ReturnType<typeof createTimer>;
    beforeEach(() => {
      context = createTimer([1000, 2000], 0);
    });
    describe('#status', () => {
      test('カウントダウン中ではない', () => {
        expect(context.timer.status).toBe('stopped');
      });
    });
    describe('#currentLapRemain', () => {
      test('残り時間は最初のラップのカウントダウン時間', () => {
        expect(context.timer.currentLapRemain).toBe(1000);
      });
    });
    describe('#currentLapIndex', () => {
      test('最初のラップのインデックスが設定されている', () => {
        expect(context.timer.currentLapIndex).toBe(0);
      });
    });
    describe('#offset', () => {
      test('指定したオフセットが設定されている', () => {
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#start', () => {
      test('カウントダウンを開始できる', () => {
        context.timer.start();
        expect(context.timer.status).toBe('countdowning');
        expect(context.timer.currentLapRemain).toBe(1000);
        expect(context.timer.currentLapIndex).toBe(0);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#reset', () => {
      test('リセットできる', () => {
        context.timer.reset();
        expect(context.timer.status).toBe('stopped');
        expect(context.timer.currentLapRemain).toBe(1000);
        expect(context.timer.currentLapIndex).toBe(0);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('@tick', () => {
      test('どれだけ待っても発火しない', () => {
        expect(context.listener.mock.calls.length).toBe(0);
        context.timeController.advanceTimeBy(1);
        context.tickController.advanceTick();
        expect(context.listener.mock.calls.length).toBe(0);
      });
    });
  });

  describe('タイマーを開始した直後の状態', () => {
    let context: ReturnType<typeof createTimer>;
    beforeEach(() => {
      context = createStartedTimer([1000, 2000], 0);
    });
    describe('#status', () => {
      test('カウントダウン中', () => {
        expect(context.timer.status).toBe('countdowning');
      });
    });
    describe('#currentLapRemain', () => {
      test('残り時間は最初のラップのカウントダウン時間', () => {
        expect(context.timer.currentLapRemain).toBe(1000);
      });
    });
    describe('#currentLapIndex', () => {
      test('最初のラップのインデックスが設定されている', () => {
        expect(context.timer.currentLapIndex).toBe(0);
      });
    });
    describe('#offset', () => {
      test('指定したオフセットが設定されている', () => {
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#start', () => {
      test('例外が発生する', () => {
        expect(() => {
          context.timer.start();
        }).toThrow();
        expect(context.timer.status).toBe('countdowning');
        expect(context.timer.currentLapRemain).toBe(1000);
        expect(context.timer.currentLapIndex).toBe(0);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#reset', () => {
      test('リセットできる', () => {
        context.timer.reset();
        expect(context.timer.status).toBe('stopped');
        expect(context.timer.currentLapRemain).toBe(1000);
        expect(context.timer.currentLapIndex).toBe(0);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('@tick', () => {
      test('TickController#advanceTick を呼び出す度に発火する', () => {
        expect(context.listener.mock.calls.length).toBe(0);
        context.timeController.advanceTimeBy(1);
        context.tickController.advanceTick();
        expect(context.listener.mock.calls.length).toBe(1);
      });
    });
  });

  describe('タイマーを開始してから少し時間が経過した状態', () => {
    let context: ReturnType<typeof createTimer>;
    beforeEach(() => {
      context = createElapsedTimer([1000, 2000], 0, 1500);
    });
    describe('#status', () => {
      test('カウントダウン中', () => {
        expect(context.timer.status).toBe('countdowning');
      });
    });
    describe('#currentLapRemain', () => {
      test('残り時間が更新されている', () => {
        expect(context.timer.currentLapRemain).toBe(1500);
      });
    });
    describe('#currentLapIndex', () => {
      test('現在のラップのインデックスが更新されている', () => {
        expect(context.timer.currentLapIndex).toBe(1);
      });
    });
    describe('#offset', () => {
      test('指定したオフセットが設定されている', () => {
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#start', () => {
      test('例外が発生する', () => {
        expect(() => {
          context.timer.start();
        }).toThrow();
        expect(context.timer.status).toBe('countdowning');
        expect(context.timer.currentLapRemain).toBe(1500);
        expect(context.timer.currentLapIndex).toBe(1);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#reset', () => {
      test('リセットできる', () => {
        context.timer.reset();
        expect(context.timer.status).toBe('stopped');
        expect(context.timer.currentLapRemain).toBe(1000);
        expect(context.timer.currentLapIndex).toBe(0);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('@tick', () => {
      test('TickController#advanceTick を呼び出す度に発火する', () => {
        expect(context.listener.mock.calls.length).toBe(1);
        context.timeController.advanceTimeBy(1);
        context.tickController.advanceTick();
        expect(context.listener.mock.calls.length).toBe(2);
      });
    });
  });

  describe('タイマーを開始してから十分時間が経過した状態', () => {
    let context: ReturnType<typeof createTimer>;
    beforeEach(() => {
      context = createElapsedTimer([1000, 2000], 0, 3000);
    });
    describe('#status', () => {
      test('カウントダウン終了', () => {
        expect(context.timer.status).toBe('stopped');
      });
    });
    describe('#currentLapRemain', () => {
      test('残り時間は 0 になる', () => {
        expect(context.timer.currentLapRemain).toBe(0);
      });
    });
    describe('#currentLapIndex', () => {
      test('現在のラップのインデックスは最終ラップのインデックスになる', () => {
        expect(context.timer.currentLapIndex).toBe(1);
      });
    });
    describe('#offset', () => {
      test('指定したオフセットが設定されている', () => {
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#start', () => {
      test('カウントダウンを開始できる', () => {
        context.timer.start();
        expect(context.timer.status).toBe('countdowning');
        expect(context.timer.currentLapRemain).toBe(1000);
        expect(context.timer.currentLapIndex).toBe(0);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('#reset', () => {
      test('リセットできる', () => {
        context.timer.reset();
        expect(context.timer.status).toBe('stopped');
        expect(context.timer.currentLapRemain).toBe(1000);
        expect(context.timer.currentLapIndex).toBe(0);
        expect(context.timer.offset).toBe(0);
      });
    });
    describe('@tick', () => {
      test('どれだけ待っても発火しない', () => {
        expect(context.listener.mock.calls.length).toBe(1);
        context.timeController.advanceTimeBy(1);
        context.tickController.advanceTick();
        expect(context.listener.mock.calls.length).toBe(1);
      });
    });
  });
});
