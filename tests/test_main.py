import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from main import get_platform_info, get_greeting

def test_get_platform_info():
    info = get_platform_info()
    assert "Antigravity running on" in info
    assert "inside Docker!" in info

def test_get_greeting():
    greeting = get_greeting()
    assert greeting == "Hello from the Agent inside Docker!"
