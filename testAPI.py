import os
import pytest
from dotenv import load_dotenv
load_dotenv()  # loads .env from current working directory (or parents)

def test_openai_key_present():
    assert os.getenv("OPENAI_API_KEY"), "OPENAI_API_KEY is not set in this environment"

def test_openai_call():
    from openai import OpenAI
    client = OpenAI()  # reads OPENAI_API_KEY
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Say OK"}],
        max_tokens=5,
    )
    assert "OK" in resp.choices[0].message.content

def test_anthropic_installed():
    try:
        import anthropic  # noqa
    except Exception as e:
        pytest.fail(f"anthropic package not installed in this interpreter: {e}")

def test_anthropic_key_present():
    assert os.getenv("ANTHROPIC_API_KEY"), "ANTHROPIC_API_KEY is not set in this environment"

def test_anthropic_call():
    from anthropic import Anthropic
    client = Anthropic()  # reads ANTHROPIC_API_KEY
    resp = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=5,
        messages=[{"role": "user", "content": "Say OK"}],
    )
    assert "OK" in resp.content[0].text
