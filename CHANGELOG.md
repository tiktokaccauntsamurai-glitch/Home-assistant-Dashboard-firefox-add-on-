# Changelog

## 2.4

### Added
- Home Assistant display modes for each device: **Button**, **Status** (read-only state
  indicator) and **Sensor** (value with unit). **Auto** picks a mode from the entity domain.
- Sensor tiles can show a second value on the same tile, for example temperature and humidity.
  `climate` and `weather` entities show their built-in humidity automatically.
- Short letters before sensor values (T, H, W, E, P, B, V, A, L, CO2, PM). A unit that
  repeats the letter is written once (`W 412.7`).
- Binary sensors use Home Assistant's wording for each device class (door "Open"/"Closed",
  motion "Detected"/"Clear", moisture "Wet"/"Dry"). Safety alerts turn the tile red.
- Unavailable and missing entities are shown as such instead of looking off.
- Hovering over a tile shows the entity name, its ID and when it was last updated. Clicking
  opens the entity history in Home Assistant.
- **Check** button in the settings: fetches an entity from Home Assistant, shows its value
  and fills in the display name.
- Per-sensor decimal places setting.
- [Home Assistant test mock](https://github.com/tiktokaccauntsamurai-glitch/Home-Assistant-test-mock): a fake Home Assistant server for testing without a real instance.

### Changed
- Each entity is requested once per polling cycle, even when several tiles use it.
- The search engine hints in the settings are now in English.

## 2.3

### Added
- Search engine selection: Google, DuckDuckGo or a custom search URL.
