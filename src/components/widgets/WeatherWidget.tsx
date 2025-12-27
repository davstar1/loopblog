import { useEffect, useMemo, useState } from "react";

type Props = {
  defaultPlace?: string; // e.g. "Sarasota, FL"
};

type Geo = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
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

export default function WeatherWidget({
  defaultPlace = "Sarasota, FL",
}: Props) {
  const [place, setPlace] = useState(() => {
    try {
      return localStorage.getItem("loopblog:wxPlace") || defaultPlace;
    } catch {
      return defaultPlace;
    }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(place);

  const [loading, setLoading] = useState(true);
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

  async function fetchWeather(p: string) {
    setLoading(true);
    setErr(null);

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          p
        )}&count=1&language=en&format=json`
      );
      const geoJson = await geoRes.json();
      const g: Geo | undefined = geoJson?.results?.[0];
      if (!g) throw new Error("Location not found");

      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
      );
      const wxJson = await wxRes.json();
      const cur = wxJson?.current;

      setTempF(
        typeof cur?.temperature_2m === "number" ? cur.temperature_2m : null
      );
      setWindMph(
        typeof cur?.wind_speed_10m === "number" ? cur.wind_speed_10m : null
      );
      setCode(typeof cur?.weather_code === "number" ? cur.weather_code : null);
      setUpdated(cur?.time ? new Date(cur.time).toLocaleString() : null);

      const label = [g.name, g.admin1, g.country].filter(Boolean).join(", ");
      setPlace(label);
      try {
        localStorage.setItem("loopblog:wxPlace", label);
      } catch {}
    } catch (e: any) {
      setErr(e?.message ?? "Weather failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWeather(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sideCard">
      <div className="wxTop">
        <div className="sideTitle">Weather</div>
        <button
          className="wxBtn"
          type="button"
          onClick={() => fetchWeather(place)}
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>

      <button
        type="button"
        className="wxPlace"
        onClick={() => {
          setDraft(place);
          setEditing((v) => !v);
        }}
        title="Change location"
      >
        {place}
      </button>

      {editing && (
        <div className="wxEdit">
          <input
            className="wxInput"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="City, State"
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
              onClick={() => {
                setEditing(false);
                fetchWeather(draft);
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="muted wxLoading">Loading…</div>
      ) : err ? (
        <div className="error">{err}</div>
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
