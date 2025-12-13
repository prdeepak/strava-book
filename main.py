import antigravity
import platform
import time

def main():
    print(f"🚀 Antigravity running on {platform.system()} inside Docker!")
    print("Agent environment is active.")
    
    # Keep script alive briefly to ensure output is captured
    time.sleep(1)

if __name__ == "__main__":
    main()
