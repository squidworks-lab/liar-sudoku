const EVENT_NAMES = new Set(["game_start", "game_complete", "game_share"]);
const GAME_MODES = new Set(["4x4", "9x9"]);
const MEASUREMENT_ID = "G-3E2VY70LKJ";

export function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" ||
    hostname === "::1" || hostname === "[::1]";
}

export function initializeGoogleAnalytics(hostname, browserWindow, browserDocument) {
  if (isLocalHostname(hostname)) return false;

  try {
    browserWindow.dataLayer = browserWindow.dataLayer || [];
    browserWindow.gtag = function gtag() {
      browserWindow.dataLayer.push(arguments);
    };
    browserWindow.gtag("js", new Date());
    browserWindow.gtag("config", MEASUREMENT_ID);

    const script = browserDocument.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    browserDocument.head.append(script);
    return true;
  } catch (error) {
    console.error("Google Analytics could not be initialized.", error);
    return false;
  }
}

export function createGameEventTracker(getGtag, onError = console.error) {
  const sentOnce = {
    game_start: new Set(),
    game_complete: new Set(),
  };

  return (eventName, { game_mode: gameMode, game_date: gameDate, attempts } = {}) => {
    if (!EVENT_NAMES.has(eventName) || !GAME_MODES.has(gameMode) ||
        typeof gameDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      throw new TypeError("ゲームイベントの名前または基本パラメーターが正しくありません。");
    }
    if (eventName === "game_complete" && (!Number.isInteger(attempts) || attempts < 1)) {
      throw new TypeError("game_completeには正の整数のattemptsが必要です。");
    }

    const parameters = { game_mode: gameMode, game_date: gameDate };
    if (eventName === "game_complete") parameters.attempts = attempts;
    const puzzleKey = `${gameMode}:${gameDate}`;
    if (eventName !== "game_share" && sentOnce[eventName].has(puzzleKey)) return false;

    try {
      const gtag = getGtag();
      if (typeof gtag !== "function") return false;
      gtag("event", eventName, parameters);
      if (eventName !== "game_share") sentOnce[eventName].add(puzzleKey);
      return true;
    } catch (error) {
      onError(`GA4 ${eventName} event could not be sent.`, error);
      return false;
    }
  };
}
