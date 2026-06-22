import httpx

url = "http://127.0.0.1:8000/investigate"
json_data = {"context": "kind-kubernetes-ai-demo-cluster"}

try:
    r = httpx.post(url, json=json_data, timeout=30.0)
    print("STATUS", r.status_code)
    print("TEXT", r.text)
    try:
        print("JSON", r.json())
    except Exception as e:
        print("JSON_ERROR", type(e).__name__, e)
except Exception as e:
    import traceback
    print("EXC", type(e).__name__, e)
    traceback.print_exc()
