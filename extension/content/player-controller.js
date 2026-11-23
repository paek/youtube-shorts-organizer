// PlayerController — owns the repeat/A-B-loop/speed state machine for a
// single <video> element. Knows nothing about YouTube's DOM (that's the
// Adapter's job, CLAUDE.md 23장 원칙 1) and nothing about the panel UI
// (CLAUDE.md 23장 원칙 2: Player Engine과 Organizer 분리).
(function () {
  window.__YTW = window.__YTW || {};

  // How close to the end of the video (in seconds) we still count as
  // "basically finished" for loop-restart detection below.
  const LOOP_DETECT_END_WINDOW = 0.5;
  // Minimum backward jump in currentTime (in seconds) we treat as a loop
  // restart rather than normal seek jitter/rounding between timeupdate ticks.
  const LOOP_DETECT_JUMP_MIN = 1.0;
  // Wait 2 seconds after the Short finishes playing before advancing.
  const ADVANCE_DELAY_MS = 2000;

  function createPlayerController() {
    let video = null;
    let repeatCount = 1; // number or Infinity
    let repeatIndex = 0;
    let desiredPlaybackRate = 1;
    let exhaustedFired = false;
    let advanceTimer = null;
    let attachedAt = 0;
    let abLoop = null; // { start, end, count } | null
    let abIndex = 0;
    let lastTime = 0; // currentTime as of the last timeupdate tick
    let lastDuration = 0; // duration as of the last timeupdate tick
    let onStateChange = null; // callback(state) for the panel to react to
    let onRepeatsExhausted = null; // callback() — finite repeat count fully used up
    let onTimeCallback = null; // callback(currentTimeSec) for live subtitle sync

    function clearAdvanceTimer() {
      if (advanceTimer !== null) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
    }

    function notifyRepeatsExhausted() {
      if (exhaustedFired) return;
      exhaustedFired = true;
      clearAdvanceTimer();
      // Hold on the end of the video during the 2-second grace period so it
      // doesn't awkwardly start replaying from 0 before advancing.
      if (video && !video.paused) {
        try {
          video.pause();
        } catch (_err) {
          // ignore
        }
      }
      console.log(`[YTW] video finished - advancing to next Short in ${ADVANCE_DELAY_MS}ms`);
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        if (typeof onRepeatsExhausted === "function") onRepeatsExhausted();
      }, ADVANCE_DELAY_MS);
    }

    function handlePlaythroughComplete(fromEndedEvent) {
      if (!video || abLoop || exhaustedFired) return;
      // Ignore spurious ended events that fire right after attaching or mid-video
      // when YouTube swaps streams on a reused <video> element.
      if (Date.now() - attachedAt < 800) return;
      if (
        fromEndedEvent &&
        Number.isFinite(video.duration) &&
        video.duration > 1.5 &&
        video.currentTime < video.duration - 1.0
      ) {
        return;
      }

      if (repeatCount === Infinity || repeatIndex < repeatCount - 1) {
        repeatIndex += 1;
        video.currentTime = 0;
        lastTime = 0; // keep our own restart from being mistaken for a loop
        video.play().catch(() => {});
      } else {
        notifyRepeatsExhausted();
      }
      emitState();
    }

    function handleEnded() {
      handlePlaythroughComplete(true);
    }

    function handleMediaReset() {
      // YouTube frequently reuses the same <video> element across Shorts.
      // Reset tracking whenever new media metadata loads so the previous
      // video's lastTime can never false-trigger a loop completion on the new one.
      lastTime = 0;
      lastDuration = video && Number.isFinite(video.duration) ? video.duration : 0;
      enforcePlayerSettings();
    }

    function enforcePlayerSettings() {
      if (!video) return;
      if (video.loop) {
        console.log("[YTW] video.loop was reset to true externally - forcing it back to false");
        video.loop = false;
      }
      if (desiredPlaybackRate && video.playbackRate !== desiredPlaybackRate) {
        video.playbackRate = desiredPlaybackRate;
      }
    }

    function handleTimeUpdate() {
      if (!video) return;
      enforcePlayerSettings();

      if (typeof onTimeCallback === "function") {
        onTimeCallback(video.currentTime);
      }

      if (abLoop) {
        if (video.currentTime >= abLoop.end) {
          if (abLoop.count === Infinity || abIndex < abLoop.count - 1) {
            abIndex += 1;
            video.currentTime = abLoop.start;
          } else {
            abLoop = null;
            abIndex = 0;
            if (repeatCount !== Infinity) {
              notifyRepeatsExhausted();
            }
          }
          emitState();
        }
        lastTime = video.currentTime;
        lastDuration = Number.isFinite(video.duration) ? video.duration : 0;
        return;
      }

      // Detect a native loop restart ONLY when:
      // 1. Duration is stable (same video, not a newly swapped Short),
      // 2. Playback was genuinely at the very end (within 0.5s of duration),
      // 3. currentTime wrapped back near 0 (< 1.0s) by at least 1.0s.
      const dur = video.duration;
      if (
        !exhaustedFired &&
        Date.now() - attachedAt > 800 &&
        Number.isFinite(dur) &&
        dur > 1.5 &&
        lastDuration > 0 &&
        Math.abs(dur - lastDuration) < 0.25 &&
        lastTime > dur - LOOP_DETECT_END_WINDOW &&
        video.currentTime < 1.0 &&
        video.currentTime < lastTime - LOOP_DETECT_JUMP_MIN
      ) {
        lastTime = video.currentTime;
        handlePlaythroughComplete(false);
        return;
      }

      lastTime = video.currentTime;
      lastDuration = Number.isFinite(dur) ? dur : 0;
    }

    function emitState() {
      if (typeof onStateChange === "function") {
        onStateChange(getState());
      }
    }

    function getState() {
      return {
        repeatCount,
        repeatIndex,
        abLoop: abLoop ? Object.assign({}, abLoop, { index: abIndex }) : null,
        playbackRate: video ? video.playbackRate : desiredPlaybackRate,
      };
    }

    function attachTo(videoEl) {
      detach();
      video = videoEl;
      if (!video) return;
      repeatIndex = 0;
      abLoop = null;
      abIndex = 0;
      lastTime = 0;
      lastDuration = Number.isFinite(video.duration) ? video.duration : 0;
      attachedAt = Date.now();
      exhaustedFired = false;
      clearAdvanceTimer();
      video.loop = false; // we take over repetition manually
      if (desiredPlaybackRate) {
        video.playbackRate = desiredPlaybackRate;
      }
      video.addEventListener("ended", handleEnded);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("playing", enforcePlayerSettings);
      video.addEventListener("loadedmetadata", handleMediaReset);
      video.addEventListener("emptied", handleMediaReset);
      emitState();
    }

    function detach() {
      clearAdvanceTimer();
      if (!video) return;
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("playing", enforcePlayerSettings);
      video.removeEventListener("loadedmetadata", handleMediaReset);
      video.removeEventListener("emptied", handleMediaReset);
      video = null;
    }

    function setRepeatCount(n) {
      repeatCount = n;
      repeatIndex = 0;
      exhaustedFired = false;
      clearAdvanceTimer();
      if (video) video.loop = false;
      emitState();
    }

    function setPlaybackRate(rate) {
      desiredPlaybackRate = rate || 1;
      if (video) video.playbackRate = desiredPlaybackRate;
      emitState();
    }

    function setABLoop(start, end, count) {
      if (start >= end) return;
      abLoop = { start, end, count };
      abIndex = 0;
      exhaustedFired = false;
      clearAdvanceTimer();
      if (video) {
        video.loop = false;
        video.currentTime = start;
        lastTime = start;
        video.play().catch(() => {});
      }
      emitState();
    }

    function clearABLoop() {
      abLoop = null;
      abIndex = 0;
      if (video) lastTime = video.currentTime;
      emitState();
    }

    function onChange(callback) {
      onStateChange = callback;
    }

    function onExhausted(callback) {
      onRepeatsExhausted = callback;
    }

    function onTime(callback) {
      onTimeCallback = callback;
    }

    return {
      attachTo,
      detach,
      setRepeatCount,
      setPlaybackRate,
      setABLoop,
      clearABLoop,
      onChange,
      onExhausted,
      onTime,
      getState,
      getCurrentTime: () => (video ? video.currentTime : 0),
    };
  }

  window.__YTW.createPlayerController = createPlayerController;
})();