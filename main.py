import antigravity
import platform
import time

def get_platform_info():
    return f"🚀 Antigravity running on {platform.system()} inside Docker!"

def get_greeting():
    return "Hello from the Agent inside Docker!"

def main():
    print(get_platform_info())
    print("Agent environment is active.")
    print(get_greeting())
    
    # Keep script alive briefly to ensure output is captured
    time.sleep(1)

if __name__ == "__main__":
    main()
