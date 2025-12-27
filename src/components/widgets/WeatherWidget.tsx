import { useEffect, useMemo, useState } from "react";

type Props = {
  defaultLabel?: string; // e.g. "Sarasota, FL"
  defaultLat?: number;
  defaultLon?: number;
};

type GeoResult = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

type CurrentWeather = {
  temperature?: number;
  windspeed?: number;
  weathercode?: number;
  time?: string;
};

function wxCodeToText(code: number) {
  if (code === 0) return "Clear";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Thunderstorm";
  return "Weather";
}

function wxCodeToIcon(code: number) {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

async function fetchJson(url: string, ms = 12000) {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(t);
  }
}

const LS_KEY = "loopblog:weatherLocation";

type StoredLoc = { label: string; lat: number; lon: number };

export default function WeatherWidget({
  defaultLabel = "Sarasota, FL",
  defaultLat = 27.3364,
  defaultLon = -82.5307,
}: Props) {
  const [label, setLabel] = useState(defaultLabel);
  const [lat, setLat] = useState(defaultLat);
  const [lon, setLon] = useState(defaultLon);

  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tempF, setTempF] = useState<number | null>(null);
  const [windMph, setWindMph] = useState<number | null>(null);
  const [code, setCode] = useState<number | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);

  const icon = useMemo(
    () => (code == null ? "🌡️" : wxCodeToIcon(code)),
    [code]
  );
  const desc = useMemo(
    () => (code == null ? "Weather" : wxCodeToText(code)),
    [code]
  );

  // Load saved location once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredLoc;
      if (
        parsed &&
        typeof parsed.lat === "number" &&
        typeof parsed.lon === "number" &&
        typeof parsed.label === "string"
      ) {
        setLabel(parsed.label);
        setLat(parsed.lat);
        setLon(parsed.lon);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadWeather(useLat = lat, useLon = lon) {
    setLoading(true);
    setErr(null);
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${useLat}&longitude=${useLon}` +
        `&current_weather=true&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

      const data = await fetchJson(url);
      const cur: CurrentWeather | undefined = data?.current_weather;
      if (!cur) throw new Error("No current_weather in response");

      if (typeof cur.temperature !== "number")
        throw new Error("Missing temperature");
      if (typeof cur.weathercode !== "number")
        throw new Error("Missing weathercode");

      setTempF(cur.temperature);
      setWindMph(typeof cur.windspeed === "number" ? cur.windspeed : null);
      setCode(cur.weathercode);
      setUpdated(cur.time ? new Date(cur.time).toLocaleString() : null);
    } catch (e: any) {
      setErr(e?.message ?? "Weather failed");
      setTempF(null);
      setWindMph(null);
      setCode(null);
      setUpdated(null);
    } finally {
      setLoading(false);
    }
  }

  async function searchAndSetLocation() {
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setErr(null);
    try {
      const geoUrl =
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          q
        )}` + `&count=1&language=en&format=json`;

      const geo = await fetchJson(geoUrl);
      const r: GeoResult | undefined = geo?.results?.[0];
      if (!r) throw new Error("Location not found");

      const newLabel = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
      setLabel(newLabel);
      setLat(r.latitude);
      setLon(r.longitude);

      try {
        const payload: StoredLoc = {
          label: newLabel,
          lat: r.latitude,
          lon: r.longitude,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
      } catch {}

      setEditing(false);
      setQuery("");

      // fetch immediately for new coords
      await loadWeather(r.latitude, r.longitude);
    } catch (e: any) {
      setErr(e?.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  }

  // fetch whenever lat/lon changes initially
  useEffect(() => {
    loadWeather(lat, lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  return (
    <div className="sideCard">
      <div className="wxTop">
        <div className="sideTitle">Weather</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="wxBtn"
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label="Change location"
          >
            🔎
          </button>
          <button
            className="wxBtn"
            type="button"
            onClick={() => loadWeather()}
            aria-label="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="wxPlace" style={{ cursor: "default" }}>
        {label}
      </div>

      {editing && (
        <div className="wxEdit">
          <input
            className="wxInput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try: "Tampa, FL" or "New York"'
            onKeyDown={(e) => {
              if (e.key === "Enter") searchAndSetLocation();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <div className="wxEditActions">
            <button
              className="wxBtnPill ghost"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              className="wxBtnPill"
              type="button"
              onClick={searchAndSetLocation}
              disabled={searching}
            >
              {searching ? "Searching…" : "Set"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="muted wxLoading">Loading…</div>
      ) : err ? (
        <div className="error" style={{ fontSize: 12, lineHeight: 1.35 }}>
          Weather error: {err}
        </div>
      ) : (
        <div className="wxBody">
          <div className="wxMain">
            <div className="wxIcon" aria-hidden="true">
              {icon}
            </div>
            <div>
              <div className="wxTemp">
                {tempF != null ? Math.round(tempF) : "--"}
                <span className="wxUnit">°F</span>
              </div>
              <div className="wxMeta">
                <div className="wxDesc">{desc}</div>
                <div className="muted wxSmall">
                  Wind: {windMph != null ? Math.round(windMph) : "--"} mph
                </div>
                {updated && (
                  <div className="muted wxSmall">Updated: {updated}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
