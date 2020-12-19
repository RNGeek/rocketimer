import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { perf, wait } from 'react-performance-testing';
import 'jest-performance-testing';
import { RecoilRoot } from 'recoil';
import { App } from '../src/App';
import { TestableTimerController } from '../src/lib/timer/timer-controller';
import { log } from './helper/log';
import { getStatistics, saveStatistics } from './helper/statistics';

// タイマーの更新に掛かる時間 (更新時間) を計測するベンチマーク。
// この測定値を見ることでタイマーが 60 fps で描画されるかどうかを判断する
// 手がかりとなることを期待している。
//
// react-performance-testing を使い、仮想 DOM における描画の処理時間を計測する。
// 測定結果は github-action-benchmark へと送信されるようになっており、
// 以前の測定値から一定量悪化する commit を push すると CI が fail し、
// commit comment が付くようになっている。

// ## 測定結果の分析における注意点について
// - 毎フレーム更新されるコンポーネントは TimerTimeline と TimerRemainDisplay の2つだけ
//   - そのため TimerTimeline と TimerRemainDisplay の更新時間のみを測定している
// - 60 fps を実現するには 1 フレームあたり 10 ms 秒以内に処理が完了していると良い、とされている
//   - ref: https://web.dev/rail/#animation:-produce-a-frame-in-10-ms
// - また react-performance-testing によるテストは仮想 DOM によるテストであり、DOM API のオーバーヘッドが考慮されていない
// - 加えてテストは development build で実行される
//   - (本当は production build でテストするべきだけど、@testing-library/react が production build でのテストに対応していないので諦めている)
// - ... といったように様々な変数が背後にあるため、ユーザ環境ではここで測定値から推測できるパフォーマンスと大きく異なる可能性がある
//   - このテストに通ったからといってユーザ環境でも 60 fps で動作するとは言えない
//   - そのためこの測定値を分析する時は、そうした変数が背後にあることを考慮するように

// ## 計測できるレイヤーと外部要因
// レイヤー別に考えると...
//   1. Update Timer State (rocketimer)
//   2. Render Virtual DOM (React)
//   3. Reconciliation (React)
//   4. Update DOM Tree (ブラウザ)
//   5. Render Tree (ブラウザ)
//   6. Calculate Style (ブラウザ)
//   7. Layout (ブラウザ)
//   8. Paint (ブラウザ)
//   9. Composite Layers (ブラウザ)
// というレイヤーがあって、この内今回計測対象に含まれるのは 1 〜 3 の部分。
// またこの測定に影響を及ぼす外部要因として、以下のようなものがある。
//   1. JIT の最適化
//   2. マシンスペック
//   3. GC 発生の有無
//   4. 他プロセスによる CPU の使用
// この内、1 と 3 についてはその影響が無視出来るよう工夫を施している。
// ただしそれ以外については依然として影響するので分析の際には注意する。

// NOTE: ベンチマークそのものは jest で動かす必要はないのだけど、react-performance-testing を使いたくて、
// それを手軽に動かせる環境が jest だったので jest で動かしている、という経緯がある。

// 測定の際に何回コンポーネントを更新するか
// NOTE: 上げれば上げるほど RME が小さくなるが、あんまり大きい数にすると CPU の温度が上がるためか測定結果に
// 波が出てしまうことが分かったので、ひとまず様子を見て 300 回としている
const UPDATE_COUNT_FOR_MEASUREMENT = 300;

// 暖機運転の際に何回コンポーネントを更新するか
const UPDATE_COUNT_FOR_WARM_UP = 5000;

// jsdom で mock しきれない部分があるので、手動で mock してやる
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = async () => {};
  window.performance.mark = () => {};
  window.performance.measure = () => {};
});

test('タイマーが 60 fps で描画されることをテストする', async () => {
  const timerController = new TestableTimerController(new Date(2020, 0, 1, 0, 0, 0, 0).getDate());

  // パフォーマンスの測定を開始
  const { renderTime } = perf<{ TimerTimeline: unknown; TimerRemainDisplay: unknown }>(React);

  render(
    <RecoilRoot>
      <App timerController={timerController} />
    </RecoilRoot>,
  );

  // カウントダウンを開始させる
  fireEvent.click(screen.getByTestId('start-countdown-button'));

  // NOTE: 一度も実行されたことのないコードは JIT の最適化が施されていないため、最初のうちは実行する度に
  // コンパイルし直され、次第に実行時間が短くなっていく。その結果、コンポーネントの更新時間が最初の 10 回の
  // 更新と次の 10 回の更新とでは差が出てしまう。これはグラフなどにして測定結果をまとめるのを難しくしてしまう。
  //
  // そのため、ここでは測定前に UPDATE_COUNT_FOR_WARM_UP 回 タイマーを更新しておき、JIT の最適化を誘発させている。
  // ちなみにこのテクニックは一般に「暖機運転」と呼ばれている。
  for (let i = 0; i < UPDATE_COUNT_FOR_WARM_UP; i++) {
    timerController.advanceBy(16);
  }

  // 挙動を想定しやすいよう、TimerTimeline や TimerRemainDisplay に表示される状態を 2020-11-11 00:00:00 のものに
  // 再設定してから測定を開始する
  timerController.advanceTo(new Date(2020, 10, 11, 11, 0, 0, 0).getDate());

  // UPDATE_COUNT_FOR_MEASUREMENT 回 animation frame を発生させる
  for (let i = 0; i < UPDATE_COUNT_FOR_MEASUREMENT; i++) {
    // NOTE: GC の停止時間が発生すると計測結果に外れ値が現れる可能性がある。計測結果からは
    // GC の停止時間によるものなのか、アプリケーションコードのミスによるものなのか判断が難しく、
    // また、グラフなどにして測定結果をまとめるのにも都合が悪いという問題がある。
    //
    // そこでここではコンポーネントの更新中に GC ができるだけ発生しないような工夫を施している。
    // 具体的には、メモリ中にある一定量のゴミが溜まったら GC が発生する性質を逆手に取り、
    // コンポーネントの更新前に GC を強制的に発生させておき、コンポーネントの更新時にゴミが
    // ほとんどない状況を作っている。これにより、コンポーネントの更新時にゴミが GC 発生のしきい値を
    // 超えることがなくなり、コンポーネントの更新中に GC が発生しなくなるはず、という期待をしている。
    global.gc();

    // タイマーを更新
    timerController.advanceBy(16);
  }

  await wait(() => {}); // 測定結果を集計 (`renderTime.current.*` に測定結果が代入される)

  // それぞれのコンポーネントの更新時間一覧を取得
  // NOTE: 暖気運転した分の更新時間も含まれているので slice する
  const updatesForTimerTimeline = renderTime.current.TimerTimeline.updates.slice(-UPDATE_COUNT_FOR_MEASUREMENT);
  const updatesForTimerRemainDisplay = renderTime.current.TimerRemainDisplay.updates.slice(
    -UPDATE_COUNT_FOR_MEASUREMENT,
  );
  const countsPerSecondForTimerTimeline = updatesForTimerTimeline.map((update) => 1 / (update / 1000));
  const countsPerSecondForTimerRemainDisplay = updatesForTimerRemainDisplay.map((update) => 1 / (update / 1000));

  const statForTimerTimeline = getStatistics(countsPerSecondForTimerTimeline);
  const statForTimerRemainDisplay = getStatistics(countsPerSecondForTimerRemainDisplay);

  // github-action-benchmark 向けに結果を書き出す
  await saveStatistics('1秒あたりに <TimerTimeline> を何回レンダリングできるか', 'counts/second', statForTimerTimeline);
  await saveStatistics(
    '1秒あたりに <TimerRemainDisplay> を何回レンダリングできるか',
    'counts/second',
    statForTimerRemainDisplay,
  );

  // 標準出力にも書き出す
  log({ statForTimerTimeline, updatesForTimerTimeline, countsPerSecondForTimerTimeline });
  log({ statForTimerRemainDisplay, updatesForTimerRemainDisplay, countsPerSecondForTimerRemainDisplay });
});
