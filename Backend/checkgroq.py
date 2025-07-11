from groq import Groq

def is_groq_api_key_valid(api_key: str) -> bool:
    try:
        client = Groq(api_key=api_key)
        # Try a minimal call (list models)
        models = client.models.list()
        return True
    except Exception as e:
        print(f"API key check failed: {e}")
        return False

if __name__ == "__main__":
    api_key = input("Enter your Groq API key: ").strip()
    if is_groq_api_key_valid(api_key):
        print("✅ Groq API key is valid!")
    else:
        print("❌ Groq API key is invalid or unauthorized.")