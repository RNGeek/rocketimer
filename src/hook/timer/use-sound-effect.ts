import { useMemo, useEffect, useCallback } from 'react';
import { formatDuration } from '../../lib/timer/duration';
import tickTackAudioPath from '../../audio/ticktack.mp3';
import endedAudioPath from '../../audio/ended.mp3';
import { usePrevious } from '../use-previous';
import { UseCascadeTimerResult } from './use-cascade-timer';

function useAudio(path: string) {
  const audio = useMemo(() => new Audio(path), [path]);
  const play = useCallback(() => {
    audio.play();
  }, [audio]);
  return { play };
}

/** 秒の位が変わる時と残り時間が 0 になった時に音を鳴らす */
export function useSoundEffect(timer: UseCascadeTimerResult) {
  const { status, currentLapRemain, currentLapIndex } = timer;

  const { play: playTickTack } = useAudio(tickTackAudioPath);
  const { play: playEndedAudio } = useAudio(endedAudioPath);

  const prevStatus = usePrevious(status);
  const prevCurrentLapIndex = usePrevious(currentLapIndex);
  const { seconds } = formatDuration(currentLapRemain);
  const prevSeconds = usePrevious(seconds);

  useEffect(() => {
    if (prevStatus === 'countdowning' && status === 'ended') {
      playEndedAudio();
    } else if (status === 'countdowning' && prevCurrentLapIndex !== currentLapIndex) {
      playEndedAudio();
    } else if (status === 'countdowning' && prevSeconds !== seconds && seconds < 10) {
      playTickTack();
    }
  }, [currentLapIndex, playEndedAudio, playTickTack, prevCurrentLapIndex, prevSeconds, prevStatus, seconds, status]);
}