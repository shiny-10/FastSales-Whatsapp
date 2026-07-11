import requests, json, traceback

BASE = "http://localhost:8000"

payload = {
    "waba_id": "838320585997537",
    "phone_number_id": "1098705496663792",
    "access_token": "EAAOmF80niikBR8vQMvugHTiCcyjhG4ZCjsScHoqmjyGpa451ggzZBd2H7JFjCDShpscOow2ezW16ucI3qTx2aBZB47HrXtO4amOMpIjbRZAfAT6L6UvwmqTtmRNa9mJaZBxPdkHYSfmRvYr6LAEIFdpvonoZCQfCnbMRMZA1ARm6IZAH5uT7LYZAz8ZAtyJTW2NpJS1Vjvn9Wy5rD4tMTZACSnYwAeb1jIvZAGZBgoZBZAk0ck3P5Mn593QdAEkdZAJxl0VWZCMxtf87JhzlPaUvVFpVz6O5187fbnwZDZD"
}

print("POST ->", f"{BASE}/api/whatsapp/connect")
try:
    r = requests.post(f"{BASE}/api/whatsapp/connect", json=payload, timeout=30)
    print("Status:", r.status_code)
    try:
        print("JSON:\n", r.json())
    except Exception:
        print(r.text)
except Exception:
    traceback.print_exc()

print('\nGET ->', f"{BASE}/api/whatsapp/account")
try:
    r = requests.get(f"{BASE}/api/whatsapp/account", timeout=30)
    print("Status:", r.status_code)
    try:
        print("JSON:\n", r.json())
    except Exception:
        print(r.text)
except Exception:
    traceback.print_exc()
