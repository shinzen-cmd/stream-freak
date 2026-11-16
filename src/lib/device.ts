/**
 * Detects whether the app is running inside an Android TV / Smart TV environment.
 * MainActivity appends "StreamFreakTV/1.0" to the WebView User-Agent on Leanback/TV devices.
 */
export function isTvDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /StreamFreakTV|Android TV|GoogleTV|BRAVIA|AFT[A-Z0-9]+|SHIELD Android TV|MiTV|SMART-TV|SmartTV|Tizen|Web0S/i.test(
    navigator.userAgent
  );
}
