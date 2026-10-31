"""Tests use an explicit disposable runner credential, never local secrets."""
import pytest


@pytest.fixture(autouse=True)
def runner_test_token(monkeypatch):
    monkeypatch.setenv('RUNNER_TOKEN', 'test-runner-token-01234567890123456789')
