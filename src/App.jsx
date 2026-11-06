import { useState, useEffect } from "react";
import "./App.css";

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";

function getWeather(code) {
  if (code === 0) return { text: "Clear Sky", icon: "☀️" };
  if ([1, 2].includes(code)) return { text: "Partly Cloudy", icon: "🌤️" };
  if (code === 3) return { text: "Overcast", icon: "☁️" };
  if ([45, 48].includes(code)) return { text: "Foggy", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code))
    return { text: "Drizzle", icon: "🌦️" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { text: "Rainy", icon: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { text: "Snowy", icon: "❄️" };
  if ([95, 96, 99].includes(code))
    return { text: "Thunderstorm", icon: "⛈️" };
  return { text: "Unknown", icon: "🌡️" };
}

function getDay(date, index) {
  if (index === 0) return "Today";
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function App() {
  const [cityInput, setCityInput] = useState("");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [fahrenheit, setFahrenheit] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("weatherFavorites")) || [];
    } catch {
      return [];
    }
  });

  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("weatherRecent")) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("weatherFavorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("weatherRecent", JSON.stringify(recent));
  }, [recent]);

  async function loadWeather(city) {
    if (!city.trim()) {
      setError("Please enter a city name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const geoResponse = await fetch(
        `${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
      );

      if (!geoResponse.ok) throw new Error("City search failed.");

      const geoData = await geoResponse.json();

      if (!geoData.results?.length) {
        throw new Error("City not found. Please try another name.");
      }

      const place = geoData.results[0];

      await loadCoordinates(
        place.latitude,
        place.longitude,
        place.name,
        place.country
      );
    } catch (err) {
      setError(err.message || "Unable to load weather. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCoordinates(latitude, longitude, name, country = "") {
    setLoading(true);
    setError("");

    try {
      const url =
        `${WEATHER_API}?latitude=${latitude}&longitude=${longitude}` +
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,pressure_msl" +
        "&hourly=temperature_2m,precipitation_probability,weather_code" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
        "&timezone=auto&forecast_days=7";

      const response = await fetch(url);

      if (!response.ok) throw new Error("Weather information is unavailable.");

      const data = await response.json();
      const current = data.current;

      const hourlyIndex = data.hourly.time.reduce(
        (closest, time, index) => {
          const currentDifference = Math.abs(
            new Date(time).getTime() - new Date(current.time).getTime()
          );

          const closestDifference = Math.abs(
            new Date(data.hourly.time[closest]).getTime() -
              new Date(current.time).getTime()
          );

          return currentDifference < closestDifference ? index : closest;
        },
        0
      );
const updatedWeather = {
  name,
  country,
  latitude,
  longitude,
  current,
  hourly: data.hourly,
  daily: data.daily,
  hourlyIndex,
  timezone: data.timezone,
};

      setWeather(updatedWeather);

      setRecent((previous) =>
        [
          { name, country, latitude, longitude },
          ...previous.filter(
            (item) => item.name.toLowerCase() !== name.toLowerCase()
          ),
        ].slice(0, 5)
      );
    } catch (err) {
      setError(err.message || "Unable to load weather.");
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    setError("");

    if (!navigator.geolocation) {
      setError("Your browser does not support location services.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await loadCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          "Your Location"
        );
      },
      () => {
        setLoading(false);
        setError("Location permission denied. Please search for a city.");
      }
    );
  }

  function toggleFavorite(place) {
    const exists = favorites.some(
      (item) => item.name.toLowerCase() === place.name.toLowerCase()
    );

    if (exists) {
      setFavorites((previous) =>
        previous.filter(
          (item) => item.name.toLowerCase() !== place.name.toLowerCase()
        )
      );
    } else {
      setFavorites((previous) => [...previous, place]);
    }
  }

  function isFavorite(name) {
    return favorites.some(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );
  }

  function displayTemp(value) {
    if (value === undefined || value === null) return "--";
    const temperature = fahrenheit ? (value * 9) / 5 + 32 : value;
    return `${Math.round(temperature)}°${fahrenheit ? "F" : "C"}`;
  }

  function formatHour(date) {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    });
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  const current = weather?.current;
  const currentCondition = current
    ? getWeather(current.weather_code)
    : null;

  const currentPlace = weather
    ? {
        name: weather.name,
        country: weather.country,
        latitude: weather.latitude,
        longitude: weather.longitude,
      }
    : null;

  const hourlyItems = weather
    ? Array.from({ length: 6 }, (_, index) => {
        const i = weather.hourlyIndex + index;
        return i < weather.hourly.time.length
          ? {
              time: weather.hourly.time[i],
              temp: weather.hourly.temperature_2m[i],
              rain: weather.hourly.precipitation_probability[i],
              code: weather.hourly.weather_code[i],
            }
          : null;
      }).filter(Boolean)
    : [];

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🌤️</span>
          <div>
            <h1>Weather <span>Forecast</span></h1>
            <p>Explore the weather around the world</p>
          </div>
        </div>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            loadWeather(cityInput);
          }}
        >
          <input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="🔍  Search city..."
            aria-label="Search city"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </button>
        </form>

        <div className="header-actions">
          <button className="location-button" onClick={useMyLocation}>
            📍 My Location
          </button>

          <button
            className="unit-button"
            onClick={() => setFahrenheit((previous) => !previous)}
          >
            °{fahrenheit ? "F" : "C"} / °{fahrenheit ? "C" : "F"}
          </button>

          <button
            className="theme-button"
            onClick={() => setDark((previous) => !previous)}
            aria-label="Toggle dark mode"
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      {error && <div className="error-message">⚠️ {error}</div>}

      {!weather && !loading && (
        <section className="welcome">
          <div className="welcome-icon">🌦️</div>
          <h2>Welcome to Weather Forecast</h2>
          <p>Search for a city to see its current weather and 7-day forecast.</p>
          <div className="quick-cities">
            {["Hyderabad", "Chennai", "Delhi", "Mumbai", "London"].map(
              (city) => (
                <button key={city} onClick={() => loadWeather(city)}>
                  {city}
                </button>
              )
            )}
          </div>
        </section>
      )}

      {loading && <div className="loading">🌤️ Loading weather information...</div>}

      {weather && current && (
        <main className="dashboard">
          <section className="left-column">
            <article className="current-card">
              <div className="current-heading">
                <div>
                  <h2>📍 {weather.name}, {weather.country}</h2>
                  <p>
                    {new Date(current.time).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {formatTime(current.time)}
                  </p>
                </div>

                <button
                  className="save-button"
                  onClick={() => toggleFavorite(currentPlace)}
                >
                  {isFavorite(weather.name) ? "⭐ Saved" : "☆ Save"}
                </button>
              </div>

              <div className="current-main">
                <span className="main-weather-icon">{currentCondition.icon}</span>
                <div>
                  <div className="big-temp">
                    {displayTemp(current.temperature_2m)}
                  </div>
                  <h3>{currentCondition.text}</h3>
                  <p>Feels like {displayTemp(current.apparent_temperature)}</p>
                </div>
              </div>

              <div className="current-stats">
                <div>
                  <span>💧</span>
                  <p>Humidity</p>
                  <strong>{current.relative_humidity_2m}%</strong>
                </div>
                <div>
                  <span>💨</span>
                  <p>Wind Speed</p>
                  <strong>{current.wind_speed_10m} km/h</strong>
                </div>
                <div>
                  <span>🌧️</span>
                  <p>Rain Chance</p>
                  <strong>
                    {weather.hourly.precipitation_probability[
                      weather.hourlyIndex
                    ] ?? 0}%
                  </strong>
                </div>
              </div>

              <div className="sun-times">
                <div>
                  <span>🌅</span>
                  <div>
                    <small>Sunrise</small>
                    <strong>{formatTime(weather.daily.sunrise[0])}</strong>
                  </div>
                </div>
                <div>
                  <span>🌇</span>
                  <div>
                    <small>Sunset</small>
                    <strong>{formatTime(weather.daily.sunset[0])}</strong>
                  </div>
                </div>
              </div>
            </article>

            <article className="panel favorites-panel">
              <div className="panel-heading">
                <h2>⭐ Favorite Cities</h2>
                <span>{favorites.length} saved</span>
              </div>

              {favorites.length === 0 ? (
                <p className="empty-text">
                  Search for a city and press ☆ Save to add it here.
                </p>
              ) : (
                <div className="favorite-list">
                  {favorites.map((place) => (
                    <div className="favorite-item" key={place.name}>
                      <button
                        className="favorite-city"
                        onClick={() => {
                          if (
                            typeof place.latitude === "number" &&
                            typeof place.longitude === "number"
                          ) {
                            loadCoordinates(
                              place.latitude,
                              place.longitude,
                              place.name,
                              place.country
                            );
                          } else {
                            loadWeather(place.name);
                          }
                        }}
                      >
                        <span>🌤️</span>
                        <span>{place.name}</span>
                      </button>
                      <button
                        className="remove-favorite"
                        onClick={() => toggleFavorite(place)}
                        aria-label={`Remove ${place.name} from favorites`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="middle-column">
            <article className="panel">
              <div className="panel-heading">
                <h2>🕒 Hourly Forecast</h2>
                <span>Next 6 hours</span>
              </div>

              <div className="hourly-list">
                {hourlyItems.map((item) => (
                  <div className="hour-card" key={item.time}>
                    <p>{formatHour(item.time)}</p>
                    <span>{getWeather(item.code).icon}</span>
                    <strong>{displayTemp(item.temp)}</strong>
                    <small>🌧️ {item.rain ?? 0}%</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h2>📅 7-Day Forecast</h2>
              </div>

              <div className="weekly-list">
                {weather.daily.time.map((date, index) => {
                  const condition = getWeather(
                    weather.daily.weather_code[index]
                  );

                  return (
                    <div className="day-card" key={date}>
                      <strong>{getDay(date, index)}</strong>
                      <small>
                        {new Date(date + "T12:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </small>
                      <span>{condition.icon}</span>
                      <strong>
                        {displayTemp(weather.daily.temperature_2m_max[index])}
                      </strong>
                      <small>
                        {displayTemp(weather.daily.temperature_2m_min[index])}
                      </small>
                      <p>{condition.text}</p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="panel details-panel">
              <div className="panel-heading">
                <h2>🌡️ Weather Details</h2>
              </div>

              <div className="details-grid">
                <div className="detail-card">
                  <span>🌡️</span>
                  <div>
                    <p>Feels Like</p>
                    <strong>{displayTemp(current.apparent_temperature)}</strong>
                  </div>
                </div>
                <div className="detail-card">
                  <span>💧</span>
                  <div>
                    <p>Humidity</p>
                    <strong>{current.relative_humidity_2m}%</strong>
                  </div>
                </div>
                <div className="detail-card">
                  <span>💨</span>
                  <div>
                    <p>Wind Speed</p>
                    <strong>{current.wind_speed_10m} km/h</strong>
                  </div>
                </div>
                <div className="detail-card">
                  <span>🌧️</span>
                  <div>
                    <p>Rain Chance</p>
                    <strong>
                      {weather.hourly.precipitation_probability[
                        weather.hourlyIndex
                      ] ?? 0}%
                    </strong>
                  </div>
                </div>
                <div className="detail-card">
                  <span>🧭</span>
                  <div>
                    <p>Pressure</p>
                    <strong>{current.pressure_msl} hPa</strong>
                  </div>
                </div>
                <div className="detail-card">
                  <span>☀️</span>
                  <div>
                    <p>Conditions</p>
                    <strong>{currentCondition.text}</strong>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <aside className="right-column">
            <article className="panel">
              <div className="panel-heading">
                <h2>🔍 Recent Searches</h2>
              </div>

              {recent.length === 0 ? (
                <p className="empty-text">Your recent searches will appear here.</p>
              ) : (
                <div className="recent-list">
                  {recent.map((place) => (
                    <button
                      key={place.name}
                      onClick={() => {
                        if (
                          typeof place.latitude === "number" &&
                          typeof place.longitude === "number"
                        ) {
                          loadCoordinates(
                            place.latitude,
                            place.longitude,
                            place.name,
                            place.country
                          );
                        } else {
                          loadWeather(place.name);
                        }
                      }}
                    >
                      <span>📍 {place.name}</span>
                      <span>→</span>
                    </button>
                  ))}
                </div>
              )}

              {recent.length > 0 && (
                <button className="clear-button" onClick={() => setRecent([])}>
                  Clear history
                </button>
              )}
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h2>⚡ Quick Actions</h2>
              </div>

              <div className="quick-actions">
                <button onClick={useMyLocation}>
                  <span>📍</span>
                  <div>
                    <strong>My Location</strong>
                    <small>Get local weather</small>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (currentPlace) toggleFavorite(currentPlace);
                  }}
                  disabled={!weather}
                >
                  <span>⭐</span>
                  <div>
                    <strong>Save Current City</strong>
                    <small>Add or remove favorite</small>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (weather) {
                      loadCoordinates(
                        weather.latitude ?? 17.385,
                        weather.longitude ?? 78.4867,
                        weather.name,
                        weather.country
                      );
                    }
                  }}
                  disabled={!weather}
                >
                  <span>🔄</span>
                  <div>
                    <strong>Refresh Weather</strong>
                    <small>Get latest information</small>
                  </div>
                </button>
              </div>
            </article>

            <article className="tip-card">
              <span>🌈</span>
              <h2>Weather tip</h2>
              <p>
                {current.relative_humidity_2m >= 75
                  ? "Humidity is high today. Stay hydrated and dress comfortably."
                  : current.wind_speed_10m >= 25
                    ? "It is windy today. Be careful outdoors."
                    : current.temperature_2m >= 32
                      ? "It's hot today. Drink water and avoid prolonged sun exposure."
                      : "Enjoy the day! Check the forecast before heading out."}
              </p>
            </article>
          </aside>
        </main>
      )}

      <footer className="footer">
        🌤️ Weather Forecast <span>|</span> Powered by Open-Meteo
        <span>|</span> Made with React 💙
      </footer>
    </div>
  );
}

export default App;