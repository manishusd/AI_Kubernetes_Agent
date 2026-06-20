import json
import traceback
import httpx
from app.core.config import settings

print('OPENROUTER_KEY_SET', bool(settings.openrouter_api_key))
print('OPENROUTER_MODEL', settings.openrouter_model)
print('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
print('ACTUAL_ENV', {k: settings.openrouter_api_key for k in ['openrouter_api_key']})
headers = {
    'Authorization': f'Bearer {settings.openrouter_api_key}',
    'Content-Type': 'application/json',
}
payload = {
    'model': settings.openrouter_model,
    'messages': [
        {'role': 'system', 'content': 'Test connectivity.'},
        {'role': 'user', 'content': 'Hello from backend test.'},
    ],
    'temperature': 0.0,
    'max_tokens': 20,
}
try:
    with httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        resp = client.post('https://openrouter.ai/api/v1/chat/completions', headers=headers, json=payload)
        print('STATUS', resp.status_code)
        print('TEXT', resp.text)
except Exception as e:
    print('ERROR_TYPE', type(e).__name__)
    print('ERROR', str(e))
    traceback.print_exc()
