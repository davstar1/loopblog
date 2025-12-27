import { useEffect, useMemo, useState } from "react";

type Props = {
  label?: string;
  lat?: number;
  lon?: number;
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

export default function WeatherWidget({
  label = "Sarasota, FL",
  lat = 27.3364,
  lon = -82.5307,
}: Props) {
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

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
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

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15 * 60 * 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  return (
    <div className="sideCard">
      <div className="wxTop">
        <div className="sideTitle">Weather</div>
        <button
          className="wxBtn"
          type="button"
          onClick={load}
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>

      <div className="wxPlace" style={{ cursor: "default" }}>
        {label}
      </div>

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
