import subprocess
import os
from playwright.sync_api import sync_playwright

def get_opera_connection():
    # 1. Try to connect to an already running instance
    try:
        pw = sync_playwright().start()
        # This is the "User Friendly" bridge to an existing browser
        browser = pw.chromium.connect_over_cdp("http://localhost:9222")
        return browser
    except:
        # 2. If it fails, launch Opera with the right flags automatically
        print("Opera not in debug mode. Launching now...")
        
        # Path varies by OS; you'd detect this automatically
        opera_path = r"C:\Users\YourUser\AppData\Local\Programs\Opera\opera.exe" 
        
        subprocess.Popen([
            opera_path, 
            "--remote-debugging-port=9222",
            "--user-data-dir=" + os.path.expanduser("~/.opera-debug-profile")
        ])
        
        # Wait a moment for it to boot, then connect
        time.sleep(2)
        return pw.chromium.connect_over_cdp("http://localhost:9222")