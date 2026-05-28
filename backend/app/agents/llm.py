import json
from app.config import SAMBANOVA_API_KEY, GEMINI_API_KEY

def call_llm(system_prompt: str, user_message: str, response_format: str = "text") -> str:
    """
    Call SambaNova or Gemini depending on key availability.
    Falls back to a mock simulator if no keys are found, ensuring the hackathon demo works offline.
    """
    
    # 1. Try SambaNova
    if SAMBANOVA_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=SAMBANOVA_API_KEY,
                base_url="https://api.sambanova.ai/v1"
            )
            
            kwargs = {
                "model": "Meta-Llama-3.3-70B-Instruct",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.2
            }
            
            if response_format == "json":
                kwargs["response_format"] = {"type": "json_object"}
                
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            print(f"[LLM ERROR] SambaNova failed: {e}. Trying Gemini...")
            
    # 2. Try Gemini
    if GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=system_prompt
            )
            
            # Formulate user message
            response = model.generate_content(
                user_message,
                generation_config={"temperature": 0.2}
            )
            return response.text
        except Exception as e:
            print(f"[LLM ERROR] Gemini failed: {e}. Falling back to simulation...")

    # 3. Mock Fallback Simulator
    # Handles Route analysis, Co-Pilot queries, and summary generation based on inputs.
    print("[MOCK LLM] Simulating response (No API keys configured).")
    
    user_lower = user_message.lower()
    
    # Check if this is a route risk analysis query
    if "origin" in user_lower and "destination" in user_lower:
        # Route Risk Report JSON format
        if response_format == "json":
            return json.dumps({
                "safety_score": 78,
                "ai_summary": "Overall safe route, but contains high risk segments near Nandyal (Forest zone) due to wet, slippery roads and Kadapa-Tirupati (Ghat section) due to late-night isolation. Ensure you secure fuel at Kurnool as there is a critical 142 km gap until Allagadda.",
                "segment_advisories": [
                    {
                        "segment_id": "seg_hyd_kurnool",
                        "score": 90,
                        "status": "Safe",
                        "weather": "Clear, 27°C",
                        "advisory": "Standard 4-lane driving. Smooth flow, no major hazards reported. Keep steady speed."
                    },
                    {
                        "segment_id": "seg_kurnool_nandyal",
                        "score": 75,
                        "status": "Warning",
                        "weather": "Overcast, 25°C",
                        "advisory": "NH-40 construction zones. Watch for sudden diversions and gravel on road."
                    },
                    {
                        "segment_id": "seg_nandyal_allagadda",
                        "score": 45,
                        "status": "Critical",
                        "weather": "Light Rain, 24°C",
                        "advisory": "Forest corridor. Wet asphalt, low signal, and high isolation. Refuel fully at Kurnool beforehand because the Nandyal station is closed at night."
                    },
                    {
                        "segment_id": "seg_allagadda_kadapa",
                        "score": 85,
                        "status": "Safe",
                        "weather": "Clear, 26°C",
                        "advisory": "Road conditions improve. Watch for slow-moving agricultural traffic near Allagadda."
                    },
                    {
                        "segment_id": "seg_kadapa_tirupati",
                        "score": 60,
                        "status": "Warning",
                        "weather": "Foggy, 22°C",
                        "advisory": "Winding ghat roads. Widespread fog reducing visibility. Maintain low speed, use hazard lights, and watch for wildlife."
                    }
                ]
            })
        else:
            return "Overall route is moderately safe (Score 78/100). Critical concerns include a 142 km fuel gap between Kurnool and Allagadda at night, rain near Nandyal, and thick fog in the Kadapa-Tirupati ghat segment."

    # Check if this is a Co-Pilot Chat message
    if "kurnool" in user_lower or "should i stop" in user_lower or "stop before" in user_lower:
        return "Yes, you should stop. The Kurnool-to-Allagadda stretch is 142 km long and highly isolated. Since it is night, the Nandyal station is closed. Refuel completely at the Kurnool BPCL before continuing."
    
    if "weather" in user_lower or "nandyal" in user_lower:
        return "Light rain is expected around Nandyal on NH-40. The forest corridor roads will be wet and slippery. Reduce your speed to under 60 km/h and watch for sudden traction loss."
    
    if "fuel" in user_lower or "station" in user_lower or "km" in user_lower:
        return "You have 115 km of fuel range left. The next open station is Indian Oil Allagadda in 92 km. You will make it, but there are no stations in between. Do not miss this stop."
    
    if "tired" in user_lower or "fatigue" in user_lower or "stop" in user_lower:
        return "You have been riding for 3.5 hours straight. I recommend stopping at the Kurnool bypass food court in 15 km to stretch and avoid micro-drowsiness."
        
    if "location" in user_lower or "send" in user_lower:
        return "I have shared your live GPS location link with your emergency contact Priya (Sister)."

    # Default fallback chat message
    return "Understood. I am monitoring your route, weather, and speed. The road ahead is clear. Let me know if you need fuel details, weather updates, or if you feel fatigued."
