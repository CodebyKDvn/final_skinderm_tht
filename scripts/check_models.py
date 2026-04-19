import os
import requests

headers = {
    "Authorization": f"Bearer {os.getenv('NVIDIA_API_KEY')}",
    "Accept": "application/json"
}

with open("../docs/model_check.txt", "w") as f:
    try:
        response = requests.get("https://integrate.api.nvidia.com/v1/models", headers=headers)
        f.write(f"Status: {response.status_code}\n\n")
        if response.status_code == 200:
            models = response.json()
            for m in models.get('data', []):
                f.write(f"- {m['id']}\n")
        else:
            f.write(response.text)
    except Exception as e:
        f.write(f"Error: {e}\n")
print("Done writing models to model_check.txt")
