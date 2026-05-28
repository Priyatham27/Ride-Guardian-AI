import httpx
from datetime import datetime, timedelta
from app.config import OPENWEATHER_API_KEY

def get_weather_at_coordinate(lat: float, lon: float, delay_hours: float = 0.0):
    """
    Fetches weather condition for a point at a projected offset.
    Defaults to realistic mock weather data if API key is not present.
    """
    if not OPENWEATHER_API_KEY:
        # Generate simulated weather along the route based on coordinates
        # We simulate a rain cell near Nandyal (latitude ~15.48) to trigger weather risks.
        if 15.2 <= lat <= 15.6:
            return {
                "temp": 24.5,
                "condition": "Light Rain",
                "humidity": 92,
                "wind_speed_kmh": 22.0,
                "visibility_km": 4.5,
                "risk_rating": "Medium",
                "description": "Scattered rain showers. Road surface is wet and slippery."
            }
        elif 13.8 <= lat <= 14.2:
            return {
                "temp": 22.0,
                "condition": "Foggy",
                "humidity": 95,
                "wind_speed_kmh": 8.0,
                "visibility_km": 1.5,
                "risk_rating": "High",
                "description": "Dense fog in ghat sections. Visibility reduced below 2km."
            }
        else:
            return {
                "temp": 29.0 - (delay_hours * 0.8), # Cooler at night
                "condition": "Clear",
                "humidity": 60,
                "wind_speed_kmh": 12.0,
                "visibility_km": 10.0,
                "risk_rating": "Low",
                "description": "Clear skies and good visibility."
            }

    try:
        # If key is available, query real-time data or forecast from OpenWeather
        # Since we want projected ETA weather, we use the 5-day / 3-hour forecast API
        url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        response = httpx.get(url, timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            # Find the forecast entry closest to our delay_hours
            target_time = datetime.now() + timedelta(hours=delay_hours)
            closest_forecast = data["list"][0]
            min_diff = float("inf")
            for f in data["list"]:
                f_time = datetime.fromtimestamp(f["dt"])
                diff = abs((f_time - target_time).total_seconds())
                if diff < min_diff:
                    min_diff = diff
                    closest_forecast = f
            
            main = closest_forecast["main"]
            weather = closest_forecast["weather"][0]
            wind = closest_forecast["wind"]
            visibility = closest_forecast.get("visibility", 10000) / 1000.0 # Convert to km
            
            condition = weather["main"]
            desc = weather["description"].capitalize()
            temp = main["temp"]
            humidity = main["humidity"]
            wind_speed = wind["speed"] * 3.6 # m/s to km/h
            
            # Determine safety rating
            risk = "Low"
            if condition in ["Rain", "Drizzle", "Thunderstorm"] or wind_speed > 30:
                risk = "Medium"
            if condition == "Squall" or visibility < 2.0:
                risk = "High"
                
            return {
                "temp": temp,
                "condition": condition,
                "humidity": humidity,
                "wind_speed_kmh": wind_speed,
                "visibility_km": visibility,
                "risk_rating": risk,
                "description": f"{desc}. Temperature {temp}°C, visibility {visibility}km."
            }
        else:
            raise Exception("API returned error status")
    except Exception as e:
        print(f"Error fetching weather: {e}. Falling back to simulated weather.")
        # Fallback simulation
        if 15.2 <= lat <= 15.6:
            return {
                "temp": 24.5,
                "condition": "Light Rain",
                "humidity": 92,
                "wind_speed_kmh": 22.0,
                "visibility_km": 4.5,
                "risk_rating": "Medium",
                "description": "Scattered rain showers. Road surface is wet and slippery."
            }
        else:
            return {
                "temp": 27.0,
                "condition": "Clear",
                "humidity": 65,
                "wind_speed_kmh": 10.0,
                "visibility_km": 10.0,
                "risk_rating": "Low",
                "description": "Clear skies."
            }

def get_weather_along_route(waypoints):
    """
    Given a list of waypoints with approximate elapsed travel times,
    returns weather reports for each critical point.
    waypoints is a list of [lat, lon, name, elapsed_time_hours]
    """
    reports = []
    for lat, lon, name, elapsed_time in waypoints:
        weather = get_weather_at_coordinate(lat, lon, elapsed_time)
        reports.append({
            "waypoint_name": name,
            "coords": [lat, lon],
            "elapsed_time_hours": elapsed_time,
            **weather
        })
    return reports
