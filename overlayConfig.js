const dbKeys = require("./DBEntryKeys.json");
const { get, write, remove } = require("../db");
const log = require("npmlog");
const { getBlitzCore } = require("../native-utils");
const { keycode_to_key, key_to_keycode } = require("../keyinputmap");

const overlayDllName = "blitz-overlay.dll";
const processName = "League of Legends.exe";

const getGamePID = () => {
  let pId = 0;
  try {
    pId = getBlitzCore().findProcessId(processName);
  } catch (e) {
    log.error("[core]", "[overlayConfig] error", e);
  }
  return pId;
};

const getDLLName = () => {
  return overlayDllName;
};

const getProcessName = () => {
  return processName;
};

const setPreviousGamePID = async (pId) => {
  try {
    await write("overlayPreviousPID", pId);
  } catch (e) {
    log.error("[core]", "[overlayConfig] error", e);
  }
};

const getPreviousGamePID = async () => {
  let previousGamePID = 0;
  try {
    previousGamePID = (await get("overlayPreviousPID")) || 0;
    previousGamePID = Number(previousGamePID);
  } catch (e) {
    log.error("[core]", "[overlayConfig] unable to get previous pid", e);
  }
  return previousGamePID;
};

async function setConfigItem(key, value) {
  try {
    await write(key, value);
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
}

async function setIsTFT(value) {
  log.info("[core]", `setIsTFT ${value}`);
  try {
    await setConfigItem(dbKeys.IS_TFT, value);
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
}

async function getIsTFT() {
  let isTFT = false;
  try {
    let data = await get(dbKeys.IS_TFT);
    isTFT = data === "true";
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
  return isTFT;
}

async function getIsTFTSetted() {
  try {
    let data = await get(dbKeys.IS_TFT);
    return data !== null;
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
    return false;
  }
}

async function clearIsTFTSetted() {
  log.info("[core]", "clearIsTFTSetted");
  try {
    await remove(dbKeys.IS_TFT);
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
}

async function getLOLSettings() {
  return await _getJSON(dbKeys.LOL_SETTINGS);
}

async function getIsSROverlayStarted() {
  return await _getBool(dbKeys.IS_SR_OVERLAY_STARTED);
}

async function setIsSROverlayStarted(value) {
  try {
    log.info("[core]", `[overlayConfig] IsSROverlayStarted: ${value}`);
    await setConfigItem(dbKeys.IS_SR_OVERLAY_STARTED, value);
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
}

async function getTFTSettings() {
  return await _getJSON(dbKeys.TFT_SETTINGS);
}

async function getTFTOverlayPositions() {
  return await _getJSON(dbKeys.TFT_OVERLAY_POSITIONS);
}

async function getTFTOverlaySize() {
  return await _getJSON(dbKeys.TFT_OVERLAY_SIZE);
}

async function getTFTOverlayOpacity() {
  return await _getJSON(dbKeys.TFT_OVERLAY_OPACITY);
}


async function getOverlayHotkeys() {
  return await _getJSON(dbKeys.APP_OVERLAY_HOTKEYS);
}

async function getIsLOROverlayEnabled() {
  const settings = await _getJSON(dbKeys.LOR_SETTINGS);
  if (settings && settings.isLOROverlayEnabled) {
    return true;
  }
  return false;
}

async function getFNSettings() {
  return await _getJSON(dbKeys.FN_SETTINGS);
}

async function getGameData() {
  return await _getJSON(dbKeys.LOL_GAME_DATA);
}

async function getOverlayLanguage() {
  try {
    let lang = await get(dbKeys.OVERLAY_LANGUAGE);
    return lang ? lang : "en";
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
}

async function setTFTCompsOverlayPosition(position) {
  const tftOverlayPositions = await getTFTOverlayPositions();

  await write(
    dbKeys.TFT_OVERLAY_POSITIONS,
    JSON.stringify({
      ...tftOverlayPositions,
      comps: position,
    })
  );
}

async function setTFTItemsOverlayPosition(position) {
  const tftOverlayPositions = await getTFTOverlayPositions();

  await write(
    dbKeys.TFT_OVERLAY_POSITIONS,
    JSON.stringify({
      ...tftOverlayPositions,
      items: position,
    })
  );
}

async function setTFTBenchmarkingOverlayPosition(position) {
  const tftOverlayPositions = await getTFTOverlayPositions();

  await write(
    dbKeys.TFT_OVERLAY_POSITIONS,
    JSON.stringify({
      ...tftOverlayPositions,
      benchmarking: position,
    })
  );
}

async function setTFTStreamInfoOverlayPosition(position) {
  const tftOverlayPositions = await getTFTOverlayPositions();

  await write(
    dbKeys.TFT_OVERLAY_POSITIONS,
    JSON.stringify({
      ...tftOverlayPositions,
      streamInfo: position,
    })
  );
}

async function setTFTCompsOverlaySize(size) {
  const tftOverlaySize = await getTFTOverlaySize();

  await write(
    dbKeys.TFT_OVERLAY_SIZE,
    JSON.stringify({
      ...tftOverlaySize,
      comps: size,
    })
  );
}

async function setTFTItemsOverlaySize(size) {
  const tftOverlaySize = await getTFTOverlaySize();

  await write(
    dbKeys.TFT_OVERLAY_SIZE,
    JSON.stringify({
      ...tftOverlaySize,
      items: size,
    })
  );
}

async function setTFTStreamInfoOverlaySize(size) {
  const tftOverlaySize = await getTFTOverlaySize();

  await write(
    dbKeys.TFT_OVERLAY_SIZE,
    JSON.stringify({
      ...tftOverlaySize,
      streamInfo: size,
    })
  );
}

async function setTFTBenchmarkingOverlaySize(size) {
  const tftOverlaySize = await getTFTOverlaySize();

  await write(
    dbKeys.TFT_OVERLAY_SIZE,
    JSON.stringify({
      ...tftOverlaySize,
      benchmarking: size,
    })
  );
}

async function setTFTBenchmarkingOverlayOpacity(opacity) {
  const tftOverlayOpacity = await getTFTOverlayOpacity();

  await write(
    dbKeys.TFT_OVERLAY_OPACITY,
    JSON.stringify({
      ...tftOverlayOpacity,
      benchmarking: opacity,
    })
  );
}

async function setTFTOverlaySettings(values) {
  const settings = await getTFTSettings();
  const tftOverlayPositions = await getTFTOverlayPositions();
  const tftOverlaySize = await getTFTOverlaySize();
  const tftOverlayOpacity = await getTFTOverlayOpacity();

  await write(
    dbKeys.TFT_SETTINGS,
    JSON.stringify({
      ...settings,
      ...values,
    })
  );

  await write(
    dbKeys.TFT_OVERLAY_POSITIONS,
    JSON.stringify({
      ...tftOverlayPositions,
      comps: values.compositionsOverlay?.position,
      items: values.itemCombinationsOverlay?.position,
      benchmarking: values.benchmarkingOverlay?.position,
      streamInfo: values.streamInfoOverlay?.position,
    })
  );

  await write(
    dbKeys.TFT_OVERLAY_SIZE,
    JSON.stringify({
      ...tftOverlaySize,
      comps: values.compositionsOverlay?.size?.value,
      items: values.itemCombinationsOverlay?.size?.value,
      benchmarking: values.benchmarkingOverlay?.size?.value,
      streamInfo: values.streamInfoOverlay?.size?.value,
    })
  );

  await write(
    dbKeys.TFT_OVERLAY_OPACITY,
    JSON.stringify({
      ...tftOverlayOpacity,
      comps: values.compositionsOverlay?.opacity?.value,
      benchmarking: values.benchmarkingOverlay?.opacity?.value,
      streamInfo: values.streamInfoOverlay?.opacity?.value,
    })
  );
}

async function getOffsetsLastModified() {
  return await _getString(dbKeys.OFFSETS_LAST_MODIFIED);
}

async function setOffsetsLastModified(value) {
  const lastModified = _convertToString(value);
  await setConfigItem(dbKeys.OFFSETS_LAST_MODIFIED, lastModified);
}

async function getOverlayOffsets() {
  return await _getJSON(dbKeys.OFFSETS);
}

async function getOffsetsVersion() {
  return await _getString(dbKeys.OFFSETS_VERSION);
}

async function setOffsetsVersion(value) {
  const version = _convertToString(value);
  await setConfigItem(dbKeys.OFFSETS_VERSION, version);
}

async function getOffsetsServer() {
  return await _getString(dbKeys.OFFSETS_SERVER);
}

async function setOffsetsServer(value) {
  const server = _convertToString(value);
  await setConfigItem(dbKeys.OFFSETS_SERVER, server);
}

async function setOverlayOffsets(value) {
  const offsets = _convertToString(value);
  await setConfigItem(dbKeys.OFFSETS, offsets);
}

async function getRegion() {
  return await _getString(dbKeys.REGION);
}

async function getValOverlayPositions() {
  return await _getJSON(dbKeys.VAL_OVERLAY_POSITIONS);
}

async function setValOverlayPositions(value) {
  const positions = _convertToString(value);
  await setConfigItem(dbKeys.VAL_OVERLAY_POSITIONS, positions);
}

/** Valorant **/
async function getValSettings() {
  return await _getJSON(dbKeys.VAL_SETTINGS);
}

async function getIsValOverlayEnabled() {
  const settings = await getValSettings();
  if (settings?.isValOverlayEnabled === undefined) {
    return true;
  }
  return !!settings.isValOverlayEnabled;
}

async function getValPostmatchOverlayToggleKey() {
  const settings = await getValSettings();
  const key = {
    value: "TAB",
    code: key_to_keycode.Tab,
    modifiers: {
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
    },
  };

  if (settings?.valPostmatchOverlayToggleKey?.value) {
    key.value = settings?.valPostmatchOverlayToggleKey?.value;
  }

  if (keycode_to_key[settings?.valPostmatchOverlayToggleKey?.code]) {
    key.code = settings?.valPostmatchOverlayToggleKey?.code;
  }

  if (
    typeof settings?.valPostmatchOverlayToggleKey?.modifiers?.ctrlKey ===
    "boolean"
  ) {
    key.modifiers.ctrlKey =
      settings?.valPostmatchOverlayToggleKey?.modifiers?.ctrlKey;
  }

  if (
    typeof settings?.valPostmatchOverlayToggleKey?.modifiers?.altKey ===
    "boolean"
  ) {
    key.modifiers.altKey =
      settings?.valPostmatchOverlayToggleKey?.modifiers?.altKey;
  }

  if (
    typeof settings?.valPostmatchOverlayToggleKey?.modifiers?.shiftKey ===
    "boolean"
  ) {
    key.modifiers.shiftKey =
      settings?.valPostmatchOverlayToggleKey?.modifiers?.shiftKey;
  }

  return key;
}

function _convertToString(value) {
  return typeof value !== "string" ? JSON.stringify(value) : value;
}

async function _getString(key) {
  const EMPTY_STRING = "";
  try {
    return await get(key);
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
    return EMPTY_STRING;
  }
}

async function _getJSON(key) {
  let json = {};
  try {
    let data = await get(key);
    json = JSON.parse(data);
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
  return json;
}

async function _getBool(key) {
  let value = false;
  try {
    let data = await get(key);
    value = data === "true";
  } catch (e) {
    log.error("[core]", `[overlayConfig] exception ${e}`);
  }
  return value;
}

module.exports = {
  getGamePID,
  getPreviousGamePID,
  getProcessName,
  getDLLName,
  setPreviousGamePID,
  getLOLSettings,
  getIsSROverlayStarted,
  setIsSROverlayStarted,
  getTFTSettings,
  getIsTFT,
  setIsTFT,
  getIsLOROverlayEnabled,
  getOverlayLanguage,
  getFNSettings,
  setTFTCompsOverlayPosition,
  setTFTItemsOverlayPosition,
  setTFTBenchmarkingOverlayPosition,
  setTFTStreamInfoOverlayPosition,
  getTFTOverlayPositions,
  setTFTCompsOverlaySize,
  setTFTItemsOverlaySize,
  setTFTStreamInfoOverlaySize,
  setTFTBenchmarkingOverlaySize,
  setTFTBenchmarkingOverlayOpacity,
  setTFTOverlaySettings,
  getTFTOverlaySize,
  getTFTOverlayOpacity,
  getGameData,
  getOverlayOffsets,
  setOverlayOffsets,
  getOffsetsVersion,
  setOffsetsVersion,
  getOffsetsServer,
  setOffsetsServer,
  getOffsetsLastModified,
  setOffsetsLastModified,
  getRegion,
  getIsValOverlayEnabled,
  getValPostmatchOverlayToggleKey,
  getOverlayHotkeys,
  getValOverlayPositions,
  setValOverlayPositions,
  getIsTFTSetted,
  clearIsTFTSetted,
};
